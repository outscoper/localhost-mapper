#!/bin/bash

# Virtual Host Manager - Logo Export Script
# This script exports the SVG logo to various formats needed for Electron

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "🎨 Virtual Host Manager - Logo Export"
echo "======================================"
echo ""

# Check if SVG exists
if [ ! -f "icon.svg" ]; then
    echo "❌ Error: icon.svg not found!"
    exit 1
fi

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Export to PNG using available tools
export_png() {
    local size=$1
    local output=$2
    
    if command_exists inkscape; then
        inkscape icon.svg --export-filename="$output" --export-width=$size --export-height=$size
    elif command_exists rsvg-convert; then
        rsvg-convert -w $size -h $size icon.svg -o "$output"
    elif command_exists convert; then
        convert -background none icon.svg -resize ${size}x${size} "$output"
    else
        return 1
    fi
}

# Check available tools
echo "🔍 Checking available tools..."

if command_exists inkscape; then
    echo "   ✓ Inkscape found"
    TOOL="inkscape"
elif command_exists rsvg-convert; then
    echo "   ✓ rsvg-convert found"
    TOOL="rsvg-convert"
elif command_exists convert; then
    echo "   ✓ ImageMagick found"
    TOOL="convert"
else
    echo "   ⚠ No SVG conversion tool found"
    echo ""
    echo "Please install one of the following:"
    echo "  • Inkscape: brew install inkscape"
    echo "  • librsvg:  brew install librsvg"
    echo "  • ImageMagick: brew install imagemagick"
    echo ""
    echo "Or manually convert icon.svg to PNG using an online tool."
    exit 1
fi

echo ""
echo "📤 Exporting logo..."

# Create temporary directory for iconset
mkdir -p icon.iconset

# Export various sizes for .icns
echo "   Creating PNG sizes for .icns..."

SIZES=(16 32 64 128 256 512 1024)
for size in "${SIZES[@]}"; do
    echo "     - ${size}x${size}"
    if [ $size -eq 1024 ]; then
        export_png $size "icon.png"
        cp "icon.png" "icon.iconset/icon_512x512@2x.png"
    elif [ $size -eq 512 ]; then
        export_png $size "icon.iconset/icon_256x256@2x.png"
        export_png $size "icon.iconset/icon_512x512.png"
    elif [ $size -eq 256 ]; then
        export_png $size "icon.iconset/icon_128x128@2x.png"
        export_png $size "icon.iconset/icon_256x256.png"
    elif [ $size -eq 128 ]; then
        export_png $size "icon.iconset/icon_128x128.png"
        export_png $size "icon.iconset/icon_64x64@2x.png"
    elif [ $size -eq 64 ]; then
        export_png $size "icon.iconset/icon_32x32@2x.png"
    elif [ $size -eq 32 ]; then
        export_png $size "icon.iconset/icon_16x16@2x.png"
        export_png $size "icon.iconset/icon_32x32.png"
    elif [ $size -eq 16 ]; then
        export_png $size "icon.iconset/icon_16x16.png"
    fi
done

# Create .icns file (macOS)
echo ""
echo "📦 Creating icon.icns for macOS..."
if command_exists iconutil; then
    iconutil -c icns icon.iconset -o icon.icns
    echo "   ✓ icon.icns created"
else
    echo "   ⚠ iconutil not available (macOS only), skipping .icns creation"
fi

# Create .ico file (Windows) - optional
if command_exists convert; then
    echo ""
    echo "📦 Creating icon.ico for Windows..."
    convert icon.iconset/icon_16x16.png \
            icon.iconset/icon_32x32.png \
            icon.iconset/icon_48x48.png 2>/dev/null || export_png 48 "icon_48.png" \
            icon.iconset/icon_256x256.png \
            icon.ico 2>/dev/null || echo "   ⚠ Could not create icon.ico"
    rm -f icon_48.png
    [ -f icon.ico ] && echo "   ✓ icon.ico created"
fi

# Cleanup
echo ""
echo "🧹 Cleaning up..."
rm -rf icon.iconset

echo ""
echo "✅ Done! Generated files:"
echo "   • icon.svg   - Source SVG file"
echo "   • icon.png   - 1024×1024 PNG (for electron-builder)"
[ -f icon.icns ] && echo "   • icon.icns  - macOS app icon"
[ -f icon.ico ] && echo "   • icon.ico   - Windows app icon"
echo ""
echo "You can preview the logo at: logo-preview.html"
