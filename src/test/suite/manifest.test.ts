'use strict';

import * as manifest from '../../manifest';
import * as yaml from 'yaml';
import * as fs from 'fs';
import { expect } from 'chai';

describe('parseManifest', () => {
  it('parse v2 manifest', () => {
    const data = fs.readFileSync('artifacts/simple-manifest.yaml', {encoding: 'utf8'});
    const parsed = yaml.parseDocument(data);
    const result = manifest.parseManifest(parsed);
    expect(result.length).to.equal(2);
    expect(result[0].workdir).to.equal('/usr/src/app');
    expect(result[1].workdir).to.equal('/usr/src/frontend');
    expect(result[0].namespace).to.equal('test');
    expect(result[1].namespace).to.equal(undefined);
  });
});