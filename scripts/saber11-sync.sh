#!/usr/bin/env bash
# Sincroniza la carpeta saber11-prep/ (git subtree) con el repo
# https://github.com/CarlosClaudeTIPS/saber11-prep
#
# Uso:
#   scripts/saber11-sync.sh push [rama]   envía los cambios hechos aquí al otro repo
#   scripts/saber11-sync.sh pull [rama]   trae los cambios hechos allá a esta carpeta
#
# La rama por defecto es el nombre de la rama actual de este repo. Para publicar
# en producción (Vercel despliega desde main) pasa "main" explícitamente:
#   scripts/saber11-sync.sh push main
set -euo pipefail

PREFIX="saber11-prep"
REMOTE="saber11"
REMOTE_URL="https://github.com/CarlosClaudeTIPS/saber11-prep"

cd "$(git rev-parse --show-toplevel)"

if ! git remote get-url "$REMOTE" >/dev/null 2>&1; then
  git remote add "$REMOTE" "$REMOTE_URL"
fi

accion="${1:-}"
rama="${2:-$(git branch --show-current)}"

case "$accion" in
  push)
    git subtree push --prefix="$PREFIX" "$REMOTE" "$rama"
    echo "Cambios de $PREFIX/ enviados a $REMOTE_URL (rama $rama)"
    ;;
  pull)
    git fetch "$REMOTE" "$rama"
    git subtree pull --prefix="$PREFIX" "$REMOTE" "$rama" -m "chore: traer cambios de saber11-prep ($rama)"
    echo "Cambios de $REMOTE_URL (rama $rama) traídos a $PREFIX/"
    ;;
  *)
    echo "Uso: $0 push|pull [rama]" >&2
    exit 1
    ;;
esac
