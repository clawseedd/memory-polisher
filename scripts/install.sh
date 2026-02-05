#!/bin/bash
# Memory Polisher Installation Script

set -e

echo "🚀 Installing Memory Polisher..."

# Check Node.js version
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "❌ Error: Node.js 18 or higher required"
    exit 1
fi

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Run tests
echo "🧪 Running tests..."
npm test

# Create sample config if doesn't exist
if [ ! -f "config.local.yaml" ]; then
    echo "📝 Creating local config..."
    cp config.yaml config.local.yaml
fi

echo "✅ Installation complete!"
echo ""
echo "Next steps:"
echo "  1. Review config: nano config.local.yaml"
echo "  2. Test run: node src/index.js --dry-run"
echo "  3. Full polish: node src/index.js"
echo ""
echo "📚 Documentation: README.md"
echo "🐛 Issues: https://github.com/yourusername/memory-polisher/issues"
