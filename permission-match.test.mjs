import assert from 'node:assert/strict';
import { canUserEditProject } from './project-permissions.mjs';

function displayNameForEmail(email) {
  const prefix = email.split('@')[0].toLowerCase();
  const aliases = {
    'augus.liang': 'Augus',
    'josiah.winkler': 'Josiah',
    'qianyun.zhu': 'Bonnie',
    'huichong.kong': 'Huichong'
  };
  return aliases[prefix] || prefix.split('.')[0].replace(/^./, c => c.toUpperCase());
}

const manson = {
  role: 'pm',
  userEmail: 'manson.fong@liteon.com',
  displayNameForEmail
};

assert.equal(canUserEditProject({ ...manson, project: { owner: 'Manson', deputy: 'TBD' } }), true);
assert.equal(canUserEditProject({ ...manson, project: { owner: 'Bonnie', deputy: 'Manson' } }), true);
assert.equal(canUserEditProject({ ...manson, project: { owner: 'Bonnie', deputy: 'Augus' } }), false);
assert.equal(
  canUserEditProject({
    role: 'pm',
    userEmail: 'ann.smith@liteon.com',
    displayNameForEmail,
    project: { owner: 'Joann', deputy: 'TBD' }
  }),
  false,
  'partial name matches must not grant access'
);

console.log('project permission identity tests passed');
