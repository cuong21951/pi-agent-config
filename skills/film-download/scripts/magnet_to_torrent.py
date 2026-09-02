"""Fetch metadata for an info hash over HTTP trackers and save a .torrent.

The ISP throttles UDP P2P traffic, so the magnet must carry HTTP (TCP) trackers.
"""
import argparse, libtorrent as lt, time

HTTP_TRACKERS = (
    "&tr=http://tracker.opentrackr.org:1337/announce"
    "&tr=http://tracker.dler.org:6969/announce"
    "&tr=http://tracker.bt4g.com:2095/announce"
)

def fetch(hash40, out, attempts=8, wait=120):
    magnet = f"magnet:?xt=urn:btih:{hash40}{HTTP_TRACKERS}"
    for a in range(attempts):
        s = lt.session()
        s.listen_on(6881, 6891)
        s.start_dht()
        s.add_dht_router("router.bittorrent.com", 6881)
        s.add_dht_router("dht.transmissionbt.com", 6881)
        p = lt.parse_magnet_uri(magnet)
        p.save_path = "."
        h = s.add_torrent(p)
        for _ in range(wait):
            st = h.status()
            if st.has_metadata:
                info = h.torrent_file()
                t = lt.create_torrent(info)
                with open(out, "wb") as f:
                    f.write(lt.bencode(t.generate()))
                print(f"OK {out} files={info.num_files()} name={info.name()}", flush=True)
                return True
            time.sleep(1)
        print(f"attempt {a+1} timeout", flush=True)
    return False

if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("hash", help="40-char info hash (btih)")
    ap.add_argument("out", help="output .torrent path")
    a = ap.parse_args()
    raise SystemExit(0 if fetch(a.hash, a.out) else 1)
