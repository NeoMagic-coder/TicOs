# Legacy nix-shell entry — `nix-shell nix/dev-shell.nix`
# Tercih: `nix develop` (flake.nix).
{ pkgs ? import <nixpkgs> {} }:

let
  pythonEnv = pkgs.python311.withPackages (ps: with ps; [
    fastapi uvicorn pydantic pydantic-settings httpx jsonschema structlog
  ]);
in
pkgs.mkShell {
  name = "oneproduct-legacy-shell";
  buildInputs = [
    pkgs.nodejs_20
    pythonEnv
    pkgs.texlive.combined.scheme-medium
    pkgs.gnumake
  ];
}
