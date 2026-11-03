const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { test } = require('node:test');
const mongoose = require('mongoose');
const app = require('../app');
const User = require('../routes/users');

test('registration, authentication and session handling', { timeout: 30000 }, async function(t) {
  // Use a new database for every run so application data is never changed.
  const dbName = 'backend2_test_' + randomUUID().replace(/-/g, '');
  let server;
  t.after(async function() {
    if (server) await new Promise(resolve => server.close(resolve));
    try {
      if (mongoose.connection.readyState === 1 && mongoose.connection.name === dbName) {
        await mongoose.connection.dropDatabase();
      }
    } finally {
      await mongoose.disconnect();
    }
  });

  await mongoose.connect(process.env.MONGODB_TEST_URI || 'mongodb://127.0.0.1:27017', {
    dbName: dbName,
    serverSelectionTimeoutMS: 5000
  });
  await User.init();
  server = await new Promise(resolve => {
    const listener = app.listen(0, '127.0.0.1', () => resolve(listener));
  });
  const baseUrl = 'http://127.0.0.1:' + server.address().port;
  let cookie = '';

  async function request(path, fields) {
    const headers = {};
    if (cookie) headers.cookie = cookie;
    if (fields !== undefined) headers['content-type'] = 'application/json';
    const response = await fetch(baseUrl + path, {
      method: fields === undefined ? 'GET' : 'POST',
      headers: headers,
      body: fields === undefined ? undefined : JSON.stringify(fields),
      redirect: 'manual'
    });
    const sessionCookie = response.headers.getSetCookie()[0];
    if (sessionCookie) cookie = sessionCookie.split(';')[0];
    return { status: response.status, location: response.headers.get('location'), text: await response.text() };
  }

  await t.test('home renders working forms and profile requires login', async function() {
    const home = await request('/');
    assert.equal(home.status, 200);
    assert.match(home.text, /action="\/register" method="post"/);
    assert.match(home.text, /action="\/login" method="post"/);
    assert.doesNotMatch(home.text, /role="alert"/);
    assert.equal((await request('/profile')).location, '/');
    assert.equal((await request('/register')).status, 404);
    assert.equal((await request('/users')).status, 404);
  });

  await t.test('invalid registration displays a message once', async function() {
    for (const fields of [{}, { username: ['alice'], password: 'password' }, { username: ' ', password: 'password' }]) {
      assert.equal((await request('/register', fields)).location, '/');
      assert.match((await request('/')).text, /Enter a username and password/);
      assert.doesNotMatch((await request('/')).text, /role="alert"/);
    }
    assert.equal(await User.countDocuments(), 0);
  });

  await t.test('registration saves submitted data and logs in with a persistent session', async function() {
    const response = await request('/register', { username: ' alice ', password: 'correct-password', secret: 'example' });
    assert.equal(response.status, 302);
    assert.equal(response.location, '/profile');
    const profile = await request('/profile');
    assert.equal(profile.status, 200);
    assert.match(profile.text, /Welcome, alice/);
    const saved = await User.findOne({ username: 'alice' }).select('+hash +salt');
    assert.equal(saved.secret, 'example');
    assert.ok(saved.hash);
    assert.ok(saved.salt);
    assert.notEqual(saved.hash, 'correct-password');
    assert.equal(saved.password, undefined);
  });

  await t.test('logout removes access to the protected profile', async function() {
    assert.equal((await request('/logout')).location, '/');
    assert.equal((await request('/profile')).location, '/');
  });

  await t.test('duplicate usernames are handled without logging in', async function() {
    assert.equal((await request('/register', { username: 'alice', password: 'other-password' })).location, '/');
    assert.match((await request('/')).text, /already registered/);
    assert.equal(await User.countDocuments(), 1);
    assert.equal((await request('/profile')).location, '/');
  });

  await t.test('incorrect and missing credentials show an error', async function() {
    for (const fields of [{ username: 'alice', password: 'wrong' }, { username: 'unknown', password: 'wrong' }, {}]) {
      assert.equal((await request('/login', fields)).location, '/');
      assert.match((await request('/')).text, /role="alert"/);
      assert.equal((await request('/profile')).location, '/');
    }
  });

  await t.test('form submissions log in and restore the session on later requests', async function() {
    const response = await fetch(baseUrl + '/login', {
      method: 'POST',
      headers: { cookie: cookie, 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ username: 'alice', password: 'correct-password' }),
      redirect: 'manual'
    });
    assert.equal(response.status, 302);
    assert.equal(response.headers.get('location'), '/profile');
    cookie = response.headers.getSetCookie()[0].split(';')[0];
    await response.text();
    assert.match((await request('/profile')).text, /Welcome, alice/);
  });

  await t.test('profile escapes submitted usernames', async function() {
    await request('/logout');
    await request('/register', { username: '<script>alert(1)</script>', password: 'password' });
    const profile = await request('/profile');
    assert.equal(profile.status, 200);
    assert.match(profile.text, /&lt;script&gt;/);
    assert.doesNotMatch(profile.text, /<script>/);
  });
});
