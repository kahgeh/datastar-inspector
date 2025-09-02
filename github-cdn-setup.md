# GitHub CDN Setup for Datastar Inspector

## Quick Setup Steps

### 1. Create GitHub Repository
```bash
# First, create a new repository on GitHub named 'datastar-inspector'
# Then run these commands:

git remote add origin https://github.com/YOUR_USERNAME/datastar-inspector.git
git branch -M main
git push -u origin main
```

### 2. Create a GitHub Release
After pushing your code:
1. Go to your repository on GitHub
2. Click on "Releases" → "Create a new release"
3. Tag version: `v1.0.0`
4. Release title: `Datastar Inspector v1.0.0`
5. Attach both files:
   - `datastar-inspector.js`
   - `datastar-inspector.min.js`
6. Publish release

### 3. Access via jsDelivr (GitHub CDN)

Once your release is published, your files will be available at:

**Production (minified):**
```
https://cdn.jsdelivr.net/gh/YOUR_USERNAME/datastar-inspector@v1.0.0/datastar-inspector.min.js
```

**Development (full):**
```
https://cdn.jsdelivr.net/gh/YOUR_USERNAME/datastar-inspector@v1.0.0/datastar-inspector.js
```

**Latest version (auto-updates):**
```
https://cdn.jsdelivr.net/gh/YOUR_USERNAME/datastar-inspector@latest/datastar-inspector.min.js
```

## Usage Example

```html
<!DOCTYPE html>
<html>
<head>
    <title>My Datastar App</title>
</head>
<body>
    <!-- Your Datastar app content -->
    
    <!-- Load Datastar -->
    <script type="module">
        import { load, apply } from 'https://cdn.jsdelivr.net/npm/@sudodevnull/datastar';
        window.Datastar = { load, apply };
        apply();
    </script>
    
    <!-- Load Inspector from GitHub CDN -->
    <script src="https://cdn.jsdelivr.net/gh/YOUR_USERNAME/datastar-inspector@v1.0.0/datastar-inspector.min.js"></script>
    
    <!-- Initialize Inspector -->
    <script>
        // Wait for Datastar to be ready
        setTimeout(() => {
            DatastarInspector.init({
                position: 'right',
                theme: 'dark'
            });
        }, 100);
    </script>
</body>
</html>
```

## Alternative: GitHub Pages (Direct hosting)

### Enable GitHub Pages:
1. Go to Settings → Pages
2. Source: Deploy from a branch
3. Branch: main, folder: / (root)
4. Save

Your files will be available at:
```
https://YOUR_USERNAME.github.io/datastar-inspector/datastar-inspector.min.js
```

## Version Management

- Use git tags for versions: `git tag v1.0.1 && git push --tags`
- jsDelivr caches for 12 hours, use specific versions for immediate updates
- Use `@latest` for auto-updating (not recommended for production)

## Benefits of GitHub CDN via jsDelivr

- ✅ Free forever
- ✅ Global CDN with excellent performance  
- ✅ Automatic minification option (add `.min` to any JS file)
- ✅ Version control via git tags
- ✅ No npm publishing required
- ✅ Works directly with GitHub releases

Replace `YOUR_USERNAME` with your actual GitHub username.