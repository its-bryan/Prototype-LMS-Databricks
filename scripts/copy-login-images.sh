#!/usr/bin/env bash
# Copy login images from Cursor assets to public folder
# Run from project root: bash scripts/copy-login-images.sh

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
SRC_DIR="/Users/bryangunawan/.cursor/projects/Users-bryangunawan-Prototype-LMS-main/assets"
DEST_DIR="$PROJECT_DIR/public/login-images"

mkdir -p "$DEST_DIR"

cp "$SRC_DIR/Login-1-ce063ef0-b0f0-4bc5-b09c-9e44e13f4af4.png" "$DEST_DIR/login-1.png"
cp "$SRC_DIR/Login-2-ca0b9639-ad11-40d4-8c53-76b4eb39225a.png" "$DEST_DIR/login-2.png"
cp "$SRC_DIR/Login-3-f8f942dd-6236-4863-84a7-ad8fac20adc8.png" "$DEST_DIR/login-3.png"
cp "$SRC_DIR/Login-4-e8fcdd0c-8c4a-4b30-a245-98f8866cf98c.png" "$DEST_DIR/login-4.png"
cp "$SRC_DIR/Login-5-a43df8f1-f98f-4b20-86d0-53650b8bbc4c.png" "$DEST_DIR/login-5.png"

echo "Login images copied to $DEST_DIR"
