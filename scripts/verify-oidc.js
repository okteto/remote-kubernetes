// Dry run for Marketplace trusted publishing (OIDC).
//
// Runs only inside GitHub Actions with `id-token: write`. It performs the same
// GitHub OIDC -> Marketplace token exchange as `vsce publish --oidc`, then
// checks that the resulting credential has a role on the publisher. Nothing is
// packaged or uploaded, and the credential is never printed.
'use strict';

const path = require('path');
const { getOIDCCredential } = require('@vscode/vsce/out/oidc.js');
const { verifyPat } = require('@vscode/vsce/out/store.js');

async function main() {
  const { publisher } = require(path.join(__dirname, '..', 'package.json'));

  let credential;
  try {
    credential = await getOIDCCredential(publisher);
  } catch (err) {
    throw new Error(
      `OIDC token exchange failed for publisher '${publisher}'. Check that the Marketplace trusted publisher ` +
        `matches this repository and the workflow file 'publish.yml', with no environment.`,
      { cause: err },
    );
  }
  console.log(`OIDC token exchange succeeded for publisher '${publisher}'.`);

  await verifyPat({ publisherName: publisher, pat: credential });
  console.log('Trusted publishing is configured correctly. No extension was published.');
}

main().catch((err) => {
  console.error(err.message);
  if (err.cause instanceof Error) {
    console.error(`Cause: ${err.cause.message}`);
  }
  process.exit(1);
});
