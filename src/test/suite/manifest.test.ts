'use strict';

import * as manifest from '../../manifest';
import * as yaml from 'yaml';
import * as fs from 'fs';
import { expect } from 'chai';

describe('parseManifest', () => {
  it('parse v2 manifest', () => {
    const data = fs.readFileSync('src/test/suite/artifacts/simple-manifest.yaml', {encoding: 'utf8'});
    const parsed = yaml.parseDocument(data);
    const result = manifest.parseManifest(parsed);
    expect(result).to.not.equal(undefined);
    expect(result.length).to.equal(2);
    expect(result[0].workdir).to.equal('/usr/src/app');
    expect(result[1].workdir).to.equal('/usr/src/frontend');
  });

  it('parse v2 manifest without workdir', () => {
    const data = fs.readFileSync('src/test/suite/artifacts/manifest-workdir.yaml', {encoding: 'utf8'});
    const parsed = yaml.parseDocument(data);
    const result = manifest.parseManifest(parsed);
    expect(result.length).to.equal(5);
    expect(result[0].workdir).to.equal('/usr/src/app');
    expect(result[1].workdir).to.equal('/usr/src/frontend');
    expect(result[2].workdir).to.equal('');
    expect(result[3].workdir).to.equal('/usr/src/frontend');
    expect(result[4].workdir).to.equal('/usr/src/frontend');
  });

  it('parse docker-compose', () => {
    const data = fs.readFileSync('src/test/suite/artifacts/docker-compose.yaml', {encoding: 'utf8'});
    const parsed = yaml.parseDocument(data);
    const result = manifest.parseManifest(parsed);
    expect(result.length).to.equal(1);
    expect(result[0].workdir).to.equal('/usr/src/app');
    expect(result[0].name).to.equal('vote');
    expect(result[0].port).to.equal(0);
  });

  it('invalid docker-compose fails validation', () => {
    const data = fs.readFileSync('src/test/suite/artifacts/docker-compose-invalid.yaml', {encoding: 'utf8'});
    const parsed = yaml.parseDocument(data);
    const result = manifest.parseManifest(parsed);
    expect(result.length).to.equal(0);
  });

  it('valid docker-compose pases validation', () => {
    const data = fs.readFileSync('src/test/suite/artifacts/docker-compose.yaml', {encoding: 'utf8'});
    const parsed = yaml.parseDocument(data);
    const result = manifest.parseManifest(parsed);
    expect(result.length).to.equal(1);
  });

  it('parse legacy manifest', () => {
    const data = fs.readFileSync('src/test/suite/artifacts/legacy-manifest.yaml', {encoding: 'utf8'});
    const parsed = yaml.parseDocument(data);
    const result = manifest.parseManifest(parsed);
    expect(result.length).to.equal(0);
  });
});