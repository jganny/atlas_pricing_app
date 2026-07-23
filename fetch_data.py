import urllib.request
import json
import os

def download_data():
    print("Starting download of airline and airport codes...")
    
    # 1. Download Airlines
    airline_url = "https://raw.githubusercontent.com/npow/airline-codes/master/airlines.json"
    print(f"Downloading airlines from {airline_url}...")
    try:
        with urllib.request.urlopen(airline_url) as response:
            airlines = json.loads(response.read().decode('utf-8'))
        
        # Filter airlines to keep only those with valid 2-letter IATA codes
        clean_airlines = []
        for airline in airlines:
            iata = airline.get("iata")
            name = airline.get("name")
            if iata and len(iata) == 2 and iata != "\\N" and name:
                clean_airlines.append({
                    "code": iata.upper(),
                    "name": name.strip()
                })
        
        # Remove duplicates by code
        seen_airlines = {}
        for airline in clean_airlines:
            seen_airlines[airline["code"]] = airline
        clean_airlines = sorted(list(seen_airlines.values()), key=lambda x: x["code"])
        
        print(f"Processed {len(clean_airlines)} valid airlines.")
    except Exception as e:
        print(f"Error downloading airlines: {e}")
        clean_airlines = []

    # 2. Download Airports
    # Let's check another source if mwgg is too large or slow
    airport_url = "https://raw.githubusercontent.com/mwgg/Airports/master/airports.json"
    print(f"Downloading airports from {airport_url}...")
    try:
        # User Agent is needed for GitHub sometimes or if downloading large datasets
        req = urllib.request.Request(
            airport_url, 
            headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'}
        )
        with urllib.request.urlopen(req) as response:
            airports_data = json.loads(response.read().decode('utf-8'))
        
        # Process and filter airports
        # mwgg/Airports is a dict keyed by ICAO or IATA.
        # Let's see the structure. It's usually a dictionary like {"KHAF": {"name": "Half Moon Bay Airport", "iata": "HAF", "city": "Half Moon Bay", "country": "United States", ...}}
        clean_airports = []
        for key, info in airports_data.items():
            iata = info.get("iata")
            name = info.get("name")
            city = info.get("city")
            country = info.get("country")
            if iata and len(iata) == 3 and iata != "\\N" and name:
                clean_airports.append({
                    "code": iata.upper(),
                    "name": name.strip(),
                    "city": (city or "").strip(),
                    "country": (country or "").strip()
                })
        
        # Remove duplicates
        seen_airports = {}
        for airport in clean_airports:
            seen_airports[airport["code"]] = airport
        clean_airports = sorted(list(seen_airports.values()), key=lambda x: x["code"])
        
        print(f"Processed {len(clean_airports)} valid airports.")
    except Exception as e:
        print(f"Error downloading airports: {e}")
        # Try fallback to jbrooksuk/JSON-Airports if mwgg fails
        fallback_url = "https://raw.githubusercontent.com/jbrooksuk/JSON-Airports/master/airports.json"
        print(f"Trying fallback airports URL: {fallback_url}...")
        try:
            req = urllib.request.Request(
                fallback_url, 
                headers={'User-Agent': 'Mozilla/5.0'}
            )
            with urllib.request.urlopen(req) as response:
                airports_array = json.loads(response.read().decode('utf-8'))
            
            clean_airports = []
            for item in airports_array:
                iata = item.get("code") or item.get("iata")
                name = item.get("name")
                city = item.get("city")
                country = item.get("country")
                if iata and len(iata) == 3 and name:
                    clean_airports.append({
                        "code": iata.upper(),
                        "name": name.strip(),
                        "city": (city or "").strip(),
                        "country": (country or "").strip()
                    })
            seen_airports = {}
            for airport in clean_airports:
                seen_airports[airport["code"]] = airport
            clean_airports = sorted(list(seen_airports.values()), key=lambda x: x["code"])
            print(f"Processed {len(clean_airports)} airports from fallback.")
        except Exception as ex:
            print(f"Fallback failed: {ex}")
            clean_airports = []

    # 3. Download Seaports
    seaports_url = "https://raw.githubusercontent.com/marchah/sea-ports/master/lib/ports.json"
    print(f"Downloading seaports from {seaports_url}...")
    try:
        req = urllib.request.Request(
            seaports_url, 
            headers={'User-Agent': 'Mozilla/5.0'}
        )
        with urllib.request.urlopen(req) as response:
            seaports_data = json.loads(response.read().decode('utf-8'))
        
        clean_seaports = []
        for code, info in seaports_data.items():
            clean_seaports.append({
                "code": code,
                "name": (info.get("name") or "").strip(),
                "city": (info.get("city") or "").strip(),
                "country": (info.get("country") or "").strip()
            })
        clean_seaports = sorted(clean_seaports, key=lambda x: x["code"])
        print(f"Processed {len(clean_seaports)} valid seaports.")
    except Exception as e:
        print(f"Error downloading seaports: {e}")
        clean_seaports = []

    # Write output to static JSON files
    data_dir = "data"
    os.makedirs(data_dir, exist_ok=True)
    
    with open(os.path.join(data_dir, "airlines.json"), "w", encoding="utf-8") as f:
        json.dump(clean_airlines, f, indent=2, ensure_ascii=False)
        
    with open(os.path.join(data_dir, "airports.json"), "w", encoding="utf-8") as f:
        json.dump(clean_airports, f, indent=2, ensure_ascii=False)

    with open(os.path.join(data_dir, "seaports.json"), "w", encoding="utf-8") as f:
        json.dump(clean_seaports, f, indent=2, ensure_ascii=False)
        
    print("Files written successfully to data/ directory.")

if __name__ == "__main__":
    download_data()
