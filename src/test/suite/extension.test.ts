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

    describe('exact matches from supported list', () => {
        it('should accept exact matches from deploy list', () => {
            expect(isManifestSupported('okteto.yml', supportedDeployFilenames)).to.be.true;
            expect(isManifestSupported('okteto.yaml', supportedDeployFilenames)).to.be.true;
            expect(isManifestSupported('okteto-pipeline.yml', supportedDeployFilenames)).to.be.true;
            expect(isManifestSupported('okteto-pipeline.yaml', supportedDeployFilenames)).to.be.true;
            expect(isManifestSupported('docker-compose.yml', supportedDeployFilenames)).to.be.true;
            expect(isManifestSupported('docker-compose.yaml', supportedDeployFilenames)).to.be.true;
        });

        it('should accept exact matches from up list', () => {
            expect(isManifestSupported('okteto.yml', supportedUpFilenames)).to.be.true;
            expect(isManifestSupported('okteto.yaml', supportedUpFilenames)).to.be.true;
            expect(isManifestSupported('docker-compose.yml', supportedUpFilenames)).to.be.true;
            expect(isManifestSupported('docker-compose.yaml', supportedUpFilenames)).to.be.true;
        });
    });

    describe('okteto-* pattern files', () => {
        it('should accept okteto-* patterns with any supported list', () => {
            expect(isManifestSupported('okteto-stack.yml', supportedDeployFilenames)).to.be.true;
            expect(isManifestSupported('okteto-stack.yaml', supportedUpFilenames)).to.be.true;
            expect(isManifestSupported('okteto-compose.yml', supportedDeployFilenames)).to.be.true;
            expect(isManifestSupported('okteto-custom.yaml', supportedUpFilenames)).to.be.true;
            expect(isManifestSupported('okteto-frontend.yml', supportedDeployFilenames)).to.be.true;
            expect(isManifestSupported('okteto-backend.yaml', supportedUpFilenames)).to.be.true;
        });
    });

    describe('okteto.* pattern files', () => {
        it('should accept okteto.* patterns with any supported list', () => {
            expect(isManifestSupported('okteto.dev.yml', supportedDeployFilenames)).to.be.true;
            expect(isManifestSupported('okteto.dev.yaml', supportedUpFilenames)).to.be.true;
            expect(isManifestSupported('okteto.staging.yml', supportedDeployFilenames)).to.be.true;
            expect(isManifestSupported('okteto.prod.yaml', supportedUpFilenames)).to.be.true;
            expect(isManifestSupported('okteto.local.yml', supportedDeployFilenames)).to.be.true;
            expect(isManifestSupported('okteto.test.yaml', supportedUpFilenames)).to.be.true;
        });
    });

    describe('invalid filenames', () => {
        it('should reject files that do not match any pattern', () => {
            expect(isManifestSupported('manifest.yml', supportedDeployFilenames)).to.be.false;
            expect(isManifestSupported('config.yaml', supportedDeployFilenames)).to.be.false;
            expect(isManifestSupported('docker.yml', supportedDeployFilenames)).to.be.false;
            expect(isManifestSupported('okteto', supportedDeployFilenames)).to.be.false;
            expect(isManifestSupported('okteto.txt', supportedDeployFilenames)).to.be.false;
        });

        it('should reject files with wrong extensions', () => {
            expect(isManifestSupported('okteto.dev.json', supportedDeployFilenames)).to.be.false;
            expect(isManifestSupported('okteto-stack.txt', supportedDeployFilenames)).to.be.false;
            expect(isManifestSupported('okteto.yaml.bak', supportedDeployFilenames)).to.be.false;
        });
    });

    describe('edge cases', () => {
        it('should handle edge case patterns', () => {
            expect(isManifestSupported('okteto-.yml', supportedDeployFilenames)).to.be.true;
            expect(isManifestSupported('okteto..yml', supportedDeployFilenames)).to.be.true;
            expect(isManifestSupported('okteto-a-b-c.yml', supportedDeployFilenames)).to.be.true;
            expect(isManifestSupported('okteto.a.b.c.yml', supportedDeployFilenames)).to.be.true;
        });
    });

    describe('case sensitivity', () => {
        it('should be case-sensitive for exact matches', () => {
            expect(isManifestSupported('Okteto.yml', supportedDeployFilenames)).to.be.false;
            expect(isManifestSupported('OKTETO.YML', supportedDeployFilenames)).to.be.false;
            expect(isManifestSupported('Docker-Compose.yml', supportedDeployFilenames)).to.be.false;
        });

        it('should be case-sensitive for pattern matches', () => {
            expect(isManifestSupported('Okteto-stack.yml', supportedDeployFilenames)).to.be.false;
            expect(isManifestSupported('OKTETO.dev.yml', supportedDeployFilenames)).to.be.false;
            expect(isManifestSupported('okteto-Stack.YML', supportedDeployFilenames)).to.be.false;
        });
    });

    describe('empty and invalid inputs', () => {
        it('should handle empty filename', () => {
            expect(isManifestSupported('', supportedDeployFilenames)).to.be.false;
            expect(isManifestSupported('', supportedUpFilenames)).to.be.false;
        });

        it('should handle empty supported filenames array', () => {
            expect(isManifestSupported('okteto.yml', [])).to.be.false;
            expect(isManifestSupported('okteto.dev.yml', [])).to.be.true; // Pattern still matches
        });
    });
});
