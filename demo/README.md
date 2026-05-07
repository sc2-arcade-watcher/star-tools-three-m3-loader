# Demo

Browser viewer for M3 models — two source modes, export to GLB or ZIP.

## Running

From the repo root:

```bash
npx serve . -l 8000
# or
python -m http.server 8000
```

Open **http://localhost:8000/demo/**

## Source modes

**Local** — loads models from `demo/assets/Units/<Faction>/` and textures from `demo/assets/Textures/`. Select a faction then a unit; the model loads automatically.

**GitHub** — fetches the full model index from [star-assets](https://github.com/star-assets) (4 000+ models). Optionally connect a GitHub account via the **Connect GitHub** button to raise the API rate limit from 60 to 5 000 requests/hour.

## URL params

A specific model can be bookmarked or shared:

```
# Local
http://localhost:8000/demo/?src=local&race=GDI&unit=GDI_Harvester

# GitHub
http://localhost:8000/demo/?src=gh&gh=Units/GDI/GDI_Harvester.m3
```

## Controls

| Action | Control |
|--------|---------|
| Orbit | Left mouse drag |
| Pan | Right mouse drag |
| Zoom | Scroll wheel |
| Export GLB | Export GLB button |
| Download M3 + textures | Download ZIP button |

## Assets

Local model files live in `demo/assets/` (gitignored — not included in the repo).  
Place M3 files under `assets/Units/<Faction>/` and DDS textures under `assets/Textures/`.
