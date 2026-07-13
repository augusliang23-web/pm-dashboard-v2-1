const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const html = fs.readFileSync(`${__dirname}/index.html`, 'utf8');
const match = html.match(/\/\* presence-estimate:start \*\/([\s\S]*?)\/\* presence-estimate:end \*\//);
assert.ok(match, 'estimated presence activity helper is missing');

const context = {};
vm.runInNewContext(`${match[1]}; this.buildEstimatedPresenceActivities = buildEstimatedPresenceActivities;`, context);

const cutoff = Date.UTC(2026, 5, 1);
const docs = [
  {
    id: 'augus',
    data: {
      name: 'Augus',
      role: 'admin',
      usageBuckets: {
        old: { bucketId: 'old', bucketStart: cutoff - 1, bucketEnd: cutoff, activeWrites: 9 },
        current: {
          bucketId: 'current',
          bucketStart: cutoff + 1000,
          bucketEnd: cutoff + 2000,
          activeWrites: 3,
          idleWrites: 1,
          logoutWrites: 1
        }
      }
    }
  },
  {
    id: 'bonnie',
    data: {
      name: 'Bonnie',
      role: 'pm',
      usageBuckets: {
        current: {
          bucketId: 'current',
          bucketStart: cutoff + 1000,
          bucketEnd: cutoff + 2000,
          activeWrites: 2
        },
        empty: {
          bucketId: 'empty',
          bucketStart: cutoff + 3000,
          bucketEnd: cutoff + 4000
        }
      }
    }
  }
];

const result = context.buildEstimatedPresenceActivities(docs, cutoff);
assert.equal(result.length, 2);
assert.deepEqual(
  JSON.parse(JSON.stringify(result.map(item => ({
    userKey: item.userKey,
    displayName: item.displayName,
    role: item.role,
    bucketId: item.bucketId,
    activityWrites: item.activityWrites
  })))),
  [
    { userKey: 'augus', displayName: 'Augus', role: 'admin', bucketId: 'current', activityWrites: 5 },
    { userKey: 'bonnie', displayName: 'Bonnie', role: 'pm', bucketId: 'current', activityWrites: 2 }
  ]
);

console.log('presence estimate tests passed');
