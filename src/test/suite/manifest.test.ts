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

describe('parseManifest (defensive shapes)', () => {
  function parse(text: string): manifest.Manifest {
    return manifest.parseManifest(yaml.parseDocument(text));
  }

  it('returns empty manifest for an empty document', () => {
    const result = parse('');
    expect(result.services.length).to.equal(0);
    expect(result.tests.length).to.equal(0);
  });

  it('returns empty manifest for a YAML scalar', () => {
    const result = parse('"just a string"');
    expect(result.services.length).to.equal(0);
    expect(result.tests.length).to.equal(0);
  });

  it('treats a non-object dev block as no services', () => {
    const result = parse('dev: "not an object"');
    // Still recognised as v2 (dev key present), but no services parsed.
    expect(result.services.length).to.equal(0);
    expect(result.tests.length).to.equal(0);
  });

  it('treats a non-object services block as not a compose file', () => {
    const result = parse('services: "not a map"');
    expect(result.services.length).to.equal(0);
    expect(result.tests.length).to.equal(0);
  });

  it('treats a list-shaped dev entry defensively (no crash)', () => {
    const result = parse([
      'dev:',
      '  api:',
      '    - this is wrong',
      '    - dev should be a map of objects',
    ].join('\n'));
    expect(result.services.length).to.equal(1);
    expect(result.services[0].name).to.equal('api');
    // Workdir defaults to empty when the dev value is not an object.
    expect(result.services[0].workdir).to.equal('');
    expect(result.services[0].port).to.equal(0);
  });

  it('coerces a non-numeric "remote" field to port 0', () => {
    const result = parse([
      'dev:',
      '  api:',
      '    workdir: /app',
      '    remote: "twenty-two"',
    ].join('\n'));
    expect(result.services[0].port).to.equal(0);
  });

  it('keeps a numeric "remote" field as the port', () => {
    const result = parse([
      'dev:',
      '  api:',
      '    workdir: /app',
      '    remote: 2222',
    ].join('\n'));
    expect(result.services[0].port).to.equal(2222);
  });

  it('falls back to the trailing segment of sync when workdir is missing', () => {
    const result = parse([
      'dev:',
      '  api:',
      '    sync:',
      '      - .:/usr/src/app',
    ].join('\n'));
    expect(result.services[0].workdir).to.equal('/usr/src/app');
  });

  it('skips compose volumes that point at a declared named volume', () => {
    const result = parse([
      'volumes:',
      '  cache: {}',
      'services:',
      '  web:',
      '    volumes:',
      '      - cache:/var/cache',
      '      - ./code:/usr/src/app',
    ].join('\n'));
    expect(result.services.length).to.equal(1);
    expect(result.services[0].name).to.equal('web');
    expect(result.services[0].workdir).to.equal('/usr/src/app');
  });

  it('returns no services for compose services with no parseable volumes', () => {
    const result = parse([
      'services:',
      '  web:',
      '    image: nginx',
    ].join('\n'));
    expect(result.services.length).to.equal(0);
  });

  it('parses test names from a v2 test block while ignoring non-object values', () => {
    const result = parse([
      'test:',
      '  unit:',
      '    command: npm test',
      '  integration:',
      '    command: npm run it',
    ].join('\n'));
    expect(result.tests.map(t => t.name)).to.deep.equal(['unit', 'integration']);
  });
});