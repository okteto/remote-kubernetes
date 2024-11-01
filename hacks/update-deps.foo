const fs = require('fs');
const { execSync } = require('child_process');

// Read package.json
const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));

// Function to update dependencies
function updateDependencies(deps) {
  if (!deps) return;
  Object.keys(deps).forEach(dep => {
    try {
      const latestVersion = execSync(`npm show ${dep} version`).toString().trim();
      deps[dep] = `^${latestVersion}`;
    } catch (error) {
      console.error(`Error updating ${dep}: ${error.message}`);
    }
  });
}

// Update dependencies and devDependencies
updateDependencies(packageJson.dependencies);
updateDependencies(packageJson.devDependencies);

// Write updated package.json
fs.writeFileSync('package.json', JSON.stringify(packageJson, null, 2));

console.log('Dependencies updated to latest versions. Please review changes and test your application.');