# Supported Manifest File Patterns

The Remote - Kubernetes extension automatically detects Okteto manifest files in your workspace using pattern matching. Different commands support different filename patterns based on their purpose.

## Supported Patterns

### All Commands (Deploy, Destroy, Test)

Deploy-related commands support the widest range of manifest patterns:

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

### Up Command Only

The `Okteto: Up` command is more restrictive and only supports exact filenames:

- `okteto.yml`
- `okteto.yaml`
- `docker-compose.yml`
- `docker-compose.yaml`

**Note:** Pipeline manifests (`okteto-pipeline.*`) and custom variants (`okteto.dev.yml`, `okteto-stack.yml`) are **not** supported for the Up command. This ensures you're always starting development environments with standard Okteto manifests.

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

### Deploy Commands

`Okteto: Deploy`, `Okteto: Destroy`, `Okteto: Test`

- ✅ Accept all supported patterns
- ✅ Show all matching files in picker
- ✅ Support custom naming schemes

### Up Command

`Okteto: Up`

- ✅ Only accepts exact filenames
- ❌ Rejects pipeline manifests (`okteto-pipeline.*`)
- ❌ Rejects custom variants (`okteto.*.yml`, `okteto-*.yml`)
- ℹ️  This ensures development environments use standard Okteto manifests

## Examples

### Valid for Deploy Commands

```bash
okteto.yml                    # ✅ Exact match
okteto-pipeline.yaml          # ✅ Exact match
okteto.dev.yml                # ✅ Pattern match (okteto.*)
okteto-stack.yaml             # ✅ Pattern match (okteto-*)
okteto.feature-auth.yml       # ✅ Pattern match (okteto.*)
okteto-microservice-api.yml   # ✅ Pattern match (okteto-*)
```

### Valid for Up Command

```bash
okteto.yml              # ✅ Exact match only
okteto.yaml             # ✅ Exact match only
docker-compose.yml      # ✅ Exact match only
docker-compose.yaml     # ✅ Exact match only
```

### Invalid for Up Command

```bash
okteto-pipeline.yml     # ❌ Not in supported list
okteto.dev.yml          # ❌ Pattern not allowed
okteto-stack.yaml       # ❌ Pattern not allowed
```

## Best Practices

1. **Use standard names for development**: Stick to `okteto.yml` or `docker-compose.yml` for dev environments
2. **Descriptive names for variants**: Use clear, descriptive names like `okteto.staging.yml`
3. **Consistent naming**: Choose a naming convention and stick to it across your project
4. **Document your manifests**: Add comments in manifest files explaining their purpose
5. **One manifest per environment**: Avoid mixing multiple environments in a single manifest

## Troubleshooting

### "No manifests found in your workspace"

**Cause:** No files match the supported patterns

**Solutions:**
1. Check filename matches a supported pattern
2. Verify file extension is `.yml` or `.yaml` (lowercase)
3. Ensure file is not in `node_modules/` directory
4. Check filename is case-sensitive (e.g., `Okteto.yml` won't match)

### "Wrong manifest selected for Up"

**Cause:** Multiple exact-match manifests exist

**Solution:** The extension will show a picker. Select the correct `okteto.yml` or `docker-compose.yml`

### "Custom manifest not available for Up"

**Cause:** Up command only accepts exact filenames

**Solution:** Use `Okteto: Deploy` instead, or rename your manifest to `okteto.yml`

## Migration Guide

If you have custom-named manifests and want to use them with different commands:

### Before (Limited Support)

```
okteto.yml              # Works with Up and Deploy
okteto-custom.yml       # Only works with Deploy (if explicitly listed)
```

### After (Enhanced Support)

```
okteto.yml              # Works with Up and Deploy ✅
okteto.dev.yml          # Works with Deploy only ✅
okteto.staging.yml      # Works with Deploy only ✅
okteto-stack.yml        # Works with Deploy only ✅
okteto-custom.yml       # Works with Deploy only ✅
```

## Related Documentation

- [Okteto Manifest Documentation](https://www.okteto.com/docs/reference/okteto-manifest/)
- [Docker Compose in Okteto](https://www.okteto.com/docs/reference/docker-compose/)
- [Extension Commands](../readme.md#getting-started)
