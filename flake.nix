{
  inputs = {
    # Track `nixpkgs-unstable` branch instead of the default branch to avoid package build cache misses.
    # https://discourse.nixos.org/t/nix-flakes-input-repository-branches-conventions/26772/2
    nixpkgs.url = "github:nixos/nixpkgs/nixpkgs-unstable";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs = { self, nixpkgs, flake-utils }:
    flake-utils.lib.eachDefaultSystem (system:
      let pkgs = nixpkgs.legacyPackages.${system};
      in {
        devShell = pkgs.mkShell {
          buildInputs = [
            pkgs.bashInteractive             # `bash` command
            pkgs.git                         # `git` command
            pkgs.nodePackages.pnpm           # `pnpm` command
            pkgs.nodePackages.nodejs         # `node` command
          ];

          shellHook = ''
          export PATH="$(pnpm bin):$PATH"
          export PLAYWRIGHT_SKIP_VALIDATE_HOST_REQUIREMENTS=1
          '';
        };
      }
    );
}
