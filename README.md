# Datastar Inspector

Development tool for monitoring and debugging [Datastar](https://data-star.dev) signals.

Compatible with **Datastar v1.0.0-RC.7**.

Written entirely by Claude.

## Setup

### Option 1: CDN (Recommended)

**jsDelivr CDN:**
```html
<script type="module">
    // Datastar v1.0.0-RC.7 auto-initializes when imported
    import { root } from 'https://cdn.jsdelivr.net/gh/starfederation/datastar@v1.0.0-RC.7/bundles/datastar.js';

    // Make Datastar root available globally for the inspector
    window.Datastar = { root };

    // Load the inspector
    const script = document.createElement('script');
    script.src = 'https://kahgeh.github.io/datastar-inspector/datastar-inspector.min.js';
    script.onload = () => {
        DatastarInspector.init({
            position: 'right',      // 'right', 'left', or 'bottom'
            width: '400px',         // Width of the inspector panel
            theme: 'dark',          // 'dark' or 'light'
            startMinimized: false,  // Start with panel minimized
            hotkey: 'Alt+Shift+D'   // Keyboard shortcut to toggle
        });
    };
    document.body.appendChild(script);
</script>
```

### Option 2: Download and Self-Host

1. Download `datastar-inspector.js` or `datastar-inspector.min.js` from this repository
2. Include it in your project
3. Expose `window.Datastar.root` so the inspector can access signals
4. Follow the same initialization steps as above


## Usage

Once initialized, the Datastar Inspector use the keyboard shortcuts to bring it up. 

### Configuration Options

```javascript
DatastarInspector.init({
    position: 'right',       // Panel position: 'right', 'left', or 'bottom'
    width: '400px',         // Width of the inspector panel
    height: '100vh',        // Height of the inspector panel
    theme: 'dark',          // Color theme: 'dark' or 'light'
    startMinimized: false,  // Start with panel minimized
    hotkey: 'Alt+Shift+D'   // Keyboard shortcut to toggle
});
```

## License

MIT License - feel free to use this in your projects!
