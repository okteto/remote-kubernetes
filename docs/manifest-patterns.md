# Supported Manifest File Patterns

The Remote - Kubernetes extension automatically detects Okteto manifest files in your workspace using pattern matching. Different commands support different filename patterns based on their purpose.

## Supported Patterns

All Okteto commands (`Up`, `Deploy`, `Destroy`, `Test`) support the same manifest patterns:

#### Exact Filenames
- `okteto.yml`
- `okteto.yaml`
- `okteto-pipeline.yml`
- `okteto-pipeline.yaml`
- `docker-compose.yml`
- `docker-compose.yaml`

#### Wildcard Patterns

**`okteto-*.yml` / `okteto-*.yaml`**
- `okteto-stack.yml`
- `okteto-compose.yaml`
- `okteto-frontend.yml`
- `okteto-backend.yaml`
- Any file starting with `okteto-` and ending with `.yml` or `.yaml`

**`okteto.*.yml` / `okteto.*.yaml`**
- `okteto.dev.yml`
- `okteto.staging.yaml`
- `okteto.prod.yml`
- `okteto.test.yaml`
- `okteto.local.yml`
- Any file matching the pattern `okteto.<anything>.{yml,yaml}`

## Use Cases

### Environment-Specific Manifests

Maintain separate manifests for different environments:

```
okteto.dev.yml       # Development environment
okteto.staging.yml   # Staging environment
okteto.prod.yml      # Production environment
```

### Feature Branch Manifests

Create manifests for specific features:

```
okteto.feature-auth.yml      # Authentication feature
okteto.feature-api.yml       # API feature
okteto.feature-frontend.yml  # Frontend feature
```

### Component-Based Manifests

Organize by microservice or component:

```
okteto-frontend.yml
okteto-backend.yml
okteto-database.yml
okteto-cache.yml
```

### Alternative Naming

Custom naming for specific workflows:

```
okteto.local.yml    # Local development
okteto.ci.yml       # CI/CD pipeline
okteto.test.yml     # Testing environment
```

## Multiple Manifests

If your workspace contains multiple matching manifest files, the extension will:

1. **Single manifest**: Automatically select it
2. **Multiple manifests**: Show a picker dialog to let you choose

The picker dialog displays:
- Filename
- Relative path from workspace root
- Sorted alphabetically for easy selection

## File Discovery

The extension searches for manifests using the glob pattern:

```
**/{okteto,docker-compose,okteto-*,okteto.*}.{yml,yaml}
```

**Exclusions:**
- Files in `node_modules/` directories are excluded
- Filenames are case-sensitive

## Command Behavior

All Okteto commands (`Okteto: Up`, `Okteto: Deploy`, `Okteto: Destroy`, `Okteto: Test`) behave the same way:

- ✅ Accept all supported patterns (exact matches and wildcards)
- ✅ Show all matching files in picker when multiple manifests found
- ✅ Support custom naming schemes for flexible project organization
- ✅ Enable environment-specific, feature-based, and component-based workflows

## Examples

### Valid Manifest Names (All Commands)

```bash
okteto.yml                    # ✅ Exact match
okteto-pipeline.yaml          # ✅ Exact match
okteto.dev.yml                # ✅ Pattern match (okteto.*)
okteto-stack.yaml             # ✅ Pattern match (okteto-*)
okteto.feature-auth.yml       # ✅ Pattern match (okteto.*)
okteto-microservice-api.yml   # ✅ Pattern match (okteto-*)
docker-compose.yml            # ✅ Exact match
docker-compose.yaml           # ✅ Exact match
```

### Invalid Manifest Names

```bash
manifest.yml            # ❌ Doesn't match any pattern
config.yaml             # ❌ Wrong prefix
Okteto.yml              # ❌ Case sensitive
okteto.txt              # ❌ Wrong extension
```

## Best Practices

1. **Choose a clear naming convention**: Use environment-based (`okteto.dev.yml`) or component-based (`okteto-frontend.yml`) naming consistently
2. **Descriptive names**: Use clear, descriptive names that indicate purpose (e.g., `okteto.staging.yml`, `okteto-api.yml`)
3. **Standard names for simplicity**: Use `okteto.yml` for simple projects with single environments
4. **Document your manifests**: Add comments in manifest files explaining their purpose and intended use
5. **One manifest per environment**: Avoid mixing multiple environments in a single manifest

## Troubleshooting

### "No manifests found in your workspace"

**Cause:** No files match the supported patterns

**Solutions:**
1. Check filename matches a supported pattern
2. Verify file extension is `.yml` or `.yaml` (lowercase)
3. Ensure file is not in `node_modules/` directory
4. Check filename is case-sensitive (e.g., `Okteto.yml` won't match)

### "Wrong manifest selected"

**Cause:** Multiple manifests exist in workspace

**Solution:** The extension will show a picker. Select the correct manifest for your workflow

## Migration Guide

If you have custom-named manifests, they now work with all commands:

### Before (Limited Support)

```
okteto.yml              # Works with all commands
okteto-custom.yml       # Only works with Deploy (if explicitly listed)
okteto.dev.yml          # Not supported
```

### After (Enhanced Support)

```
okteto.yml              # Works with all commands ✅
okteto.dev.yml          # Works with all commands ✅
okteto.staging.yml      # Works with all commands ✅
okteto-stack.yml        # Works with all commands ✅
okteto-custom.yml       # Works with all commands ✅
```

You can now use environment-specific manifests with `Okteto: Up` for local development!

## Related Documentation

- [Okteto Manifest Documentation](https://www.okteto.com/docs/reference/okteto-manifest/)
- [Docker Compose in Okteto](https://www.okteto.com/docs/reference/docker-compose/)
- [Extension Commands](../readme.md#getting-started)
