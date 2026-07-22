import urllib.request
import zipfile
import io
import json
import os

def fetch_and_build_pincodes():
    print("Downloading official Geonames Indian Postal Codes dataset...")
    url = "https://download.geonames.org/export/zip/IN.zip"
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    
    try:
        with urllib.request.urlopen(req) as resp:
            content = resp.read()
        
        z = zipfile.ZipFile(io.BytesIO(content))
        with z.open('IN.txt') as f:
            lines = f.read().decode('utf-8', errors='ignore').splitlines()
        
        pincode_map = {}
        for line in lines:
            parts = line.split('\t')
            if len(parts) >= 6:
                pin = parts[1].strip()
                place = parts[2].strip()
                state = parts[3].strip()
                district = parts[5].strip()
                
                if pin and len(pin) == 6 and pin.isdigit():
                    if pin not in pincode_map:
                        pincode_map[pin] = {
                            "p": pin,
                            "places": [],
                            "d": district,
                            "s": state
                        }
                    if place and place not in pincode_map[pin]["places"]:
                        pincode_map[pin]["places"].append(place)
        
        pincode_list = []
        for pin in sorted(pincode_map.keys()):
            item = pincode_map[pin]
            primary_place = item["places"][0] if item["places"] else item["d"]
            other_places = ", ".join(item["places"][1:4]) if len(item["places"]) > 1 else ""
            label_parts = [pin, primary_place]
            if item["d"] and item["d"].lower() != primary_place.lower():
                label_parts.append(item["d"])
            if item["s"]:
                label_parts.append(item["s"])
            
            pincode_list.append({
                "p": pin,
                "l": f"{pin} - {primary_place} ({item['s']})" if item["s"] else f"{pin} - {primary_place}",
                "place": primary_place,
                "d": item["d"],
                "s": item["s"],
                "all": f"{pin} {primary_place} {other_places} {item['d']} {item['s']}".lower()
            })
            
        print(f"Successfully processed {len(pincode_list)} unique PIN codes.")
        
        data_dir = "data"
        os.makedirs(data_dir, exist_ok=True)
        out_path = os.path.join(data_dir, "pincodes.json")
        
        with open(out_path, "w", encoding="utf-8") as f:
            json.dump(pincode_list, f, ensure_ascii=False)
            
        file_size_kb = os.path.getsize(out_path) / 1024
        print(f"Saved {out_path} ({file_size_kb:.1f} KB)")
        
    except Exception as e:
        print(f"Error fetching pincodes: {e}")

if __name__ == "__main__":
    fetch_and_build_pincodes()
