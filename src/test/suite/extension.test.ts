/* eslint-disable @typescript-eslint/no-unused-expressions */
import { expect } from 'chai';
import { isManifestSupported } from '../../extension';

describe('isManifestSupported', () => {
    const supportedDeployFilenames = [
        'okteto-pipeline.yml',
        'okteto-pipeline.yaml',
        'docker-compose.yml',
        'docker-compose.yaml',
        'okteto.yml',
        'okteto.yaml'
    ];

    const supportedUpFilenames = [
        'docker-compose.yml',
        'docker-compose.yaml',
        'okteto.yml',
        'okteto.yaml'
    ];

    describe('with allowPatterns=true (deploy commands)', () => {
        it('should accept exact matches from supported list', () => {
            expect(isManifestSupported('okteto.yml', supportedDeployFilenames, true)).to.be.true;
            expect(isManifestSupported('okteto.yaml', supportedDeployFilenames, true)).to.be.true;
            expect(isManifestSupported('okteto-pipeline.yml', supportedDeployFilenames, true)).to.be.true;
            expect(isManifestSupported('okteto-pipeline.yaml', supportedDeployFilenames, true)).to.be.true;
            expect(isManifestSupported('docker-compose.yml', supportedDeployFilenames, true)).to.be.true;
            expect(isManifestSupported('docker-compose.yaml', supportedDeployFilenames, true)).to.be.true;
        });

        it('should accept okteto-* pattern files', () => {
            expect(isManifestSupported('okteto-stack.yml', supportedDeployFilenames, true)).to.be.true;
            expect(isManifestSupported('okteto-stack.yaml', supportedDeployFilenames, true)).to.be.true;
            expect(isManifestSupported('okteto-compose.yml', supportedDeployFilenames, true)).to.be.true;
            expect(isManifestSupported('okteto-custom.yaml', supportedDeployFilenames, true)).to.be.true;
            expect(isManifestSupported('okteto-frontend.yml', supportedDeployFilenames, true)).to.be.true;
            expect(isManifestSupported('okteto-backend.yaml', supportedDeployFilenames, true)).to.be.true;
        });

        it('should accept okteto.* pattern files', () => {
            expect(isManifestSupported('okteto.dev.yml', supportedDeployFilenames, true)).to.be.true;
            expect(isManifestSupported('okteto.dev.yaml', supportedDeployFilenames, true)).to.be.true;
            expect(isManifestSupported('okteto.staging.yml', supportedDeployFilenames, true)).to.be.true;
            expect(isManifestSupported('okteto.prod.yaml', supportedDeployFilenames, true)).to.be.true;
            expect(isManifestSupported('okteto.local.yml', supportedDeployFilenames, true)).to.be.true;
            expect(isManifestSupported('okteto.test.yaml', supportedDeployFilenames, true)).to.be.true;
        });

        it('should reject files that do not match any pattern', () => {
            expect(isManifestSupported('manifest.yml', supportedDeployFilenames, true)).to.be.false;
            expect(isManifestSupported('config.yaml', supportedDeployFilenames, true)).to.be.false;
            expect(isManifestSupported('docker.yml', supportedDeployFilenames, true)).to.be.false;
            expect(isManifestSupported('okteto', supportedDeployFilenames, true)).to.be.false;
            expect(isManifestSupported('okteto.txt', supportedDeployFilenames, true)).to.be.false;
        });

        it('should reject files with wrong extensions', () => {
            expect(isManifestSupported('okteto.dev.json', supportedDeployFilenames, true)).to.be.false;
            expect(isManifestSupported('okteto-stack.txt', supportedDeployFilenames, true)).to.be.false;
            expect(isManifestSupported('okteto.yaml.bak', supportedDeployFilenames, true)).to.be.false;
        });

        it('should handle edge cases', () => {
            expect(isManifestSupported('okteto-.yml', supportedDeployFilenames, true)).to.be.true;
            expect(isManifestSupported('okteto..yml', supportedDeployFilenames, true)).to.be.true;
            expect(isManifestSupported('okteto-a-b-c.yml', supportedDeployFilenames, true)).to.be.true;
            expect(isManifestSupported('okteto.a.b.c.yml', supportedDeployFilenames, true)).to.be.true;
        });
    });

    describe('with allowPatterns=false (up commands)', () => {
        it('should accept exact matches from supported list', () => {
            expect(isManifestSupported('okteto.yml', supportedUpFilenames, false)).to.be.true;
            expect(isManifestSupported('okteto.yaml', supportedUpFilenames, false)).to.be.true;
            expect(isManifestSupported('docker-compose.yml', supportedUpFilenames, false)).to.be.true;
            expect(isManifestSupported('docker-compose.yaml', supportedUpFilenames, false)).to.be.true;
        });

        it('should reject okteto-* pattern files', () => {
            expect(isManifestSupported('okteto-pipeline.yml', supportedUpFilenames, false)).to.be.false;
            expect(isManifestSupported('okteto-stack.yml', supportedUpFilenames, false)).to.be.false;
            expect(isManifestSupported('okteto-compose.yaml', supportedUpFilenames, false)).to.be.false;
        });

        it('should reject okteto.* pattern files', () => {
            expect(isManifestSupported('okteto.dev.yml', supportedUpFilenames, false)).to.be.false;
            expect(isManifestSupported('okteto.staging.yaml', supportedUpFilenames, false)).to.be.false;
            expect(isManifestSupported('okteto.prod.yml', supportedUpFilenames, false)).to.be.false;
        });

        it('should reject any files not in exact supported list', () => {
            expect(isManifestSupported('manifest.yml', supportedUpFilenames, false)).to.be.false;
            expect(isManifestSupported('config.yaml', supportedUpFilenames, false)).to.be.false;
            expect(isManifestSupported('okteto.txt', supportedUpFilenames, false)).to.be.false;
        });
    });

    describe('case sensitivity', () => {
        it('should be case-sensitive for exact matches', () => {
            expect(isManifestSupported('Okteto.yml', supportedDeployFilenames, true)).to.be.false;
            expect(isManifestSupported('OKTETO.YML', supportedDeployFilenames, true)).to.be.false;
            expect(isManifestSupported('Docker-Compose.yml', supportedDeployFilenames, true)).to.be.false;
        });

        it('should be case-sensitive for pattern matches', () => {
            expect(isManifestSupported('Okteto-stack.yml', supportedDeployFilenames, true)).to.be.false;
            expect(isManifestSupported('OKTETO.dev.yml', supportedDeployFilenames, true)).to.be.false;
            expect(isManifestSupported('okteto-Stack.YML', supportedDeployFilenames, true)).to.be.false;
        });
    });

    describe('empty and invalid inputs', () => {
        it('should handle empty filename', () => {
            expect(isManifestSupported('', supportedDeployFilenames, true)).to.be.false;
            expect(isManifestSupported('', supportedUpFilenames, false)).to.be.false;
        });

        it('should handle empty supported filenames array', () => {
            expect(isManifestSupported('okteto.yml', [], true)).to.be.false;
            expect(isManifestSupported('okteto.yml', [], false)).to.be.false;
            expect(isManifestSupported('okteto.dev.yml', [], true)).to.be.true; // Pattern still matches
        });
    });
});
