'use strict';

import * as manifest from '../../manifest';
import * as yaml from 'yaml';
import * as fs from 'fs';
import { expect } from 'chai';
import { URI } from 'vscode-uri';
import * as path from 'path';

describe('parseManifest', () => {
  it('parse v2 manifest', () => {
    const data = fs.readFileSync('src/test/suite/artifacts/simple-manifest.yaml', {encoding: 'utf8'});
    const parsed = yaml.parseDocument(data);
    const result = manifest.parseManifest(parsed);
    expect(result.services.length).to.equal(2);
    expect(result.tests.length).to.equal(0);
    expect(result.services[0].workdir).to.equal('/usr/src/app');
    expect(result.services[1].workdir).to.equal('/usr/src/frontend');
  });

  it('parse v2 manifest without workdir', () => {
    const data = fs.readFileSync('src/test/suite/artifacts/manifest-workdir.yaml', {encoding: 'utf8'});
    const parsed = yaml.parseDocument(data);
    const result = manifest.parseManifest(parsed);
    expect(result.services.length).to.equal(5);
    expect(result.tests.length).to.equal(0);
    expect(result.services[0].name).to.equal('api');
    expect(result.services[0].workdir).to.equal('/usr/src/app');

    expect(result.services[1].name).to.equal('env');
    expect(result.services[1].workdir).to.equal('/usr/src/frontend');

    expect(result.services[2].name).to.equal('frontend');
    expect(result.services[2].workdir).to.equal('/usr/src/frontend');

    expect(result.services[3].name).to.equal('malformed');
    expect(result.services[3].workdir).to.equal('/usr/src/frontend');

    expect(result.services[4].name).to.equal('worker');
    expect(result.services[4].workdir).to.equal('');
  });

  it('parse v2 manifest with tests', () => {
    const data = fs.readFileSync('src/test/suite/artifacts/manifest-tests.yaml', {encoding: 'utf8'});
    const parsed = yaml.parseDocument(data);
    const result = manifest.parseManifest(parsed);
    expect(result.services.length).to.equal(1);
    expect(result.tests.length).to.equal(2);
    expect(result.tests[0].name).to.equal('api');
    expect(result.tests[1].name).to.equal('frontend');
  });

  it('parse docker-compose', () => {
    const data = fs.readFileSync('src/test/suite/artifacts/docker-compose.yaml', {encoding: 'utf8'});
    const parsed = yaml.parseDocument(data);
    const result = manifest.parseManifest(parsed);
    expect(result.services.length).to.equal(1);
    expect(result.tests.length).to.equal(0);
    expect(result.services[0].workdir).to.equal('/usr/src/app');
    expect(result.services[0].name).to.equal('vote');
    expect(result.services[0].port).to.equal(0);
  });

  it('invalid docker-compose fails validation', () => {
    const data = fs.readFileSync('src/test/suite/artifacts/docker-compose-invalid.yaml', {encoding: 'utf8'});
    const parsed = yaml.parseDocument(data);
    const result = manifest.parseManifest(parsed);
    expect(result.services.length).to.equal(0);
  });

  it('valid docker-compose pases validation', () => {
    const data = fs.readFileSync('src/test/suite/artifacts/docker-compose.yaml', {encoding: 'utf8'});
    const parsed = yaml.parseDocument(data);
    const result = manifest.parseManifest(parsed);
    expect(result.services.length).to.equal(1);
  });

  it('parse legacy manifest fails validation', () => {
    const data = fs.readFileSync('src/test/suite/artifacts/legacy-manifest.yaml', {encoding: 'utf8'});
    const parsed = yaml.parseDocument(data);
    const result = manifest.parseManifest(parsed);
    expect(result.services.length).to.equal(0);
  });
});

describe('get', () => {
  it('should successfully load valid v2 manifest', async () => {
    const filePath = path.resolve(__dirname, 'artifacts/simple-manifest.yaml');
    const uri = URI.file(filePath);
    const result = await manifest.get(uri);
    expect(result.services.length).to.equal(2);
    expect(result.tests.length).to.equal(0);
  });

  it('should successfully load valid docker-compose', async () => {
    const filePath = path.resolve(__dirname, 'artifacts/docker-compose.yaml');
    const uri = URI.file(filePath);
    const result = await manifest.get(uri);
    expect(result.services.length).to.equal(1);
    expect(result.services[0].name).to.equal('vote');
  });

  it('should reject manifest with no services or tests', async () => {
    const filePath = path.resolve(__dirname, 'artifacts/docker-compose-invalid.yaml');
    const uri = URI.file(filePath);
    try {
      await manifest.get(uri);
      expect.fail('Should have thrown error');
    } catch (err) {
      expect(err).to.be.an('Error');
      if (err instanceof Error) {
        expect(err.message).to.include('not a valid manifest');
      }
    }
  });

  it('should reject legacy manifest format', async () => {
    const filePath = path.resolve(__dirname, 'artifacts/legacy-manifest.yaml');
    const uri = URI.file(filePath);
    try {
      await manifest.get(uri);
      expect.fail('Should have thrown error');
    } catch (err) {
      expect(err).to.be.an('Error');
      if (err instanceof Error) {
        expect(err.message).to.include('not a valid manifest');
      }
    }
  });

  it('should reject malformed YAML', async () => {
    const filePath = path.resolve(__dirname, 'artifacts/malformed.yaml');
    const uri = URI.file(filePath);
    try {
      await manifest.get(uri);
      expect.fail('Should have thrown error');
    } catch (err) {
      expect(err).to.be.an('Error');
      if (err instanceof Error) {
        expect(err.message).to.include('not a valid yaml file');
      }
    }
  });
});