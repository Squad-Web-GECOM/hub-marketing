#!/usr/bin/env bash
# =============================================================================
# build-liferay.sh
# Concatena [config de página] + main.js + [page].js em um único arquivo por
# página, pronto para colar no campo "JavaScript personalizado" do Liferay.
#
# Uso (a partir da raiz do projeto hub-marketing/):
#   chmod +x build-liferay.sh
#   ./build-liferay.sh
#
# Saída: js-liferay/[page].js  (um arquivo por página)
# =============================================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MAIN_JS="$SCRIPT_DIR/assets/js/main.js"
JS_DIR="$SCRIPT_DIR/assets/js"
OUT_DIR="$SCRIPT_DIR/js-liferay"

PAGES=(home admin perfil usuarios squads mesas formularios)

mkdir -p "$OUT_DIR"

echo "=== Build Liferay JS ==="
echo "Fonte: $JS_DIR"
echo "Saída: $OUT_DIR"
echo ""

for PAGE in "${PAGES[@]}"; do
  PAGE_JS="$JS_DIR/${PAGE}.js"
  OUT_FILE="$OUT_DIR/${PAGE}.js"

  if [ ! -f "$PAGE_JS" ]; then
    echo "[AVISO] $PAGE_JS não encontrado — pulando."
    continue
  fi

  {
    echo "/* =============================================================="
    echo " * Hub Marketing — ${PAGE}.js (build Liferay)"
    echo " * Gerado em: $(date '+%Y-%m-%d %H:%M:%S')"
    echo " * Contém: config + main.js + ${PAGE}.js"
    echo " * ============================================================== */"
    echo ""
    echo "// ─── Configuração desta página (ANTES de main.js) ───"
    echo "window.HUB_PAGE = '${PAGE}';"
    echo "window.HUB_PAGES = {"
    echo "  home:        '/web/mkt/home',"
    echo "  mesas:       '/web/mkt/mesas',"
    echo "  squads:      '/web/mkt/squads',"
    echo "  formularios: '/web/mkt/formularios',"
    echo "  usuarios:    '/web/mkt/usuarios',"
    echo "  admin:       '/web/mkt/admin',"
    echo "  perfil:      '/web/mkt/perfil'"
    echo "};"
    echo ""
    cat "$MAIN_JS"
    echo ""
    echo "/* --- ${PAGE}.js --- */"
    cat "$PAGE_JS"
  } > "$OUT_FILE"

  SIZE=$(wc -c < "$OUT_FILE" | tr -d ' ')
  LINES=$(wc -l < "$OUT_FILE" | tr -d ' ')
  echo "[OK] js-liferay/${PAGE}.js  (${LINES} linhas / ${SIZE} bytes)"
done

echo ""
echo "Concluído! Arquivos em: $OUT_DIR"
