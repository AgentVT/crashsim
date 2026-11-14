# CrashSim

A browser flight and crash sandbox: fly a prop plane, business jet, airliner, A-10, B-2, Apache, C-130 or F/A-18 over a destructible city, a river with a bridge and boats, and the mountains around it, then crash it and watch it break apart. Built with three.js and the Rapier physics engine in one HTML file.

Play it at https://crash.systex.io

## Run it locally

Serve the folder over HTTP (the models load with `fetch`, so opening the file directly won't load them):

```
python -m http.server 8765
```

Then open http://127.0.0.1:8765/CrashSima.html

## Co-op

`server.js` is a small WebSocket relay (Node 18+, `ws`). `install-crash-mp.sh` installs it as a systemd service behind nginx at `/mp`. The game connects to `wss://<host>/mp`, or to the URL given with `?mp=`.

## Models

The aircraft models in `models/` are by other authors under Creative Commons licences; see [CREDITS.md](CREDITS.md). The game shows the credits in its menu.
