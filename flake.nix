{
  description = "OneProduct Agent OS — reproducible dev shell (Node + Python + LaTeX)";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs = { self, nixpkgs, flake-utils }:
    flake-utils.lib.eachDefaultSystem (system:
      let
        pkgs = import nixpkgs { inherit system; };

        pythonEnv = pkgs.python311.withPackages (ps: with ps; [
          fastapi
          uvicorn
          pydantic
          pydantic-settings
          httpx
          jsonschema
          structlog
          pytest
          pytest-asyncio
        ]);
      in {
        devShells.default = pkgs.mkShell {
          name = "oneproduct-agent-os";

          packages = [
            pkgs.nodejs_20
            pkgs.nodePackages.pnpm
            pythonEnv
            pkgs.git
            pkgs.gh
            pkgs.jq
            pkgs.curl
            pkgs.gnumake
            # LaTeX toolchain for whitepaper
            pkgs.texlive.combined.scheme-medium
          ];

          shellHook = ''
            echo "⚡ OneProduct Agent OS dev shell"
            echo "   Node    : $(node --version)"
            echo "   Python  : $(python3 --version)"
            echo "   pdflatex: $(pdflatex --version 2>/dev/null | head -1)"
            echo ""
            echo "Hızlı başlangıç:"
            echo "  scripts/dev.sh    — frontend + API"
            echo "  scripts/check.sh  — testler ve build"
            echo "  make -C docs/whitepaper paper.pdf"
          '';
        };

        formatter = pkgs.alejandra;
      });
}
