# Historical Changes in Mangrove Vegetation & Hydrological Flows — Marereni Restoration Site (2007–2025)

## Overview

This repository houses the Google Earth Engine (GEE) remote sensing workflow for mapping land cover change, surface water turbidity, and coastal dynamics at the **Marereni Hydrology Restoration Site** along **Malindi-Ungwana Beach** in **Magarini Sub-County, Kilifi County, Kenya**.

Coastal mangroves in Malindi-Ungwana Bay buffer shorelines and support local livelihoods, yet tidal shifts and rapid sand accretion have blocked natural creeks, causing inland water stagnation, declining water quality, and invasion by *Prosopis juliflora*. Combining multi-temporal satellite analysis across five epochs—**2007, 2012, 2017, 2022, and 2025**—with collaborative field observations alongside the **Kenya Forestry Research Institute (KEFRI)** and local community members, this project tracks ecosystem changes and identifies practical channel excavation routes to restore tidal circulation.

> **Workflow Reusability Note:** The GEE script (configured here for the `2007` epoch via the `2006-01-01` to `2008-12-31` composite window) is designed to be reused across epochs by updating the **date range** and sensor inputs. However, **training and reference points** were collected separately per period—digitized on **Google Earth Pro** for **2007, 2012, 2017, and 2022** (minimum 30 points per class) and gathered in the field using **KoboCollect** for **2025**—so ground labels accurately reflect each timeframe.

### Land Cover Classes

| Class ID | Script Asset / Variable | Legend Label | Map Color | Ecological Notes |
| :--- | :--- | :--- | :--- | :--- |
| **1** | `mangrove_007` (`forest`) | `Mangrove` | `#006400` (Dark Green) | Native mangrove forest stands |
| **2** | `bareland_07` (`bareland`) | `Bareland` | `#808080` (Gray) | Exposed coastal sand, mudflats, and accreted beach deposits |
| **3** | `water_07` (`water`) | `Water` | `#4682B4` (Steel Blue) | Open ocean, tidal creeks, and inland stagnant ponds |
| **4** *(2025)* | `invasive_07_12_17` *(commented in 2007 script)* | `Invasive Species` / `Mixed Vegetation` | `#FFD700` (Gold) | *Prosopis juliflora* and mixed shrubland expansion captured in 2025 |

---

## Study Area & Datasets Used

* **Study Area:** **Malindi-Ungwana Beach & Marereni Hydrology Restoration Site** (Magarini Sub-County, Kilifi County, Kenya), covering approximately **4 km²** between latitudes `2°51'46" S` to `2°49'24" S` and longitudes `40°10'06" E` to `40°11'14" E`. The terrain is a gentle coastal plain rising from **0 m** at the shoreline to **8 m–17 m** inland. *(Note: Ensure the `roi` variable in the script points to your Marereni / Malindi-Ungwana boundary asset before running.)*
* **Primary Satellite Imagery:**
  * **Landsat 7 ETM+ (`LANDSAT/LE07/C02/T1_L2`):** 30 m surface reflectance imagery used for the **2007, 2012, and 2017** epochs (filtered to `< 30%` cloud cover in the script, with QA pixel cloud/shadow masking in the full workflow).
  * **Sentinel-2 MSI (`COPERNICUS/S2_HARMONIZED`):** 10 m surface reflectance imagery used for the **2022 and 2025** epochs (with `QA60` cloud/cirrus masking).
* **Elevation & Accretion Datasets:**
  * **SRTM 1 arc-sec DEM (`USGS/SRTMGL1_003`, 30 m)** and **ALOS PRISM DSM (`JAXA/ALOS/AW3D30/V4_1`, 30 m)** used for topographic profiling (1 m contours) and pixel-level elevation differencing to assess sand accretion and erosion.
* **Reference & Field Data:**
  * Historical training points digitized in **Google Earth Pro** (2007–2022), field-verified GPS points collected via **KoboCollect** (2025), and joint field assessments with **KEFRI** and local stakeholders.

---

## Methodology

1. **Preprocessing & Sensor Harmonization:** Satellite scenes are filtered by epoch date window and study boundary, cloud-masked, median-composited, and clipped to the Malindi-Ungwana Beach ROI.
2. **Spectral & Vegetation Index Stack:** Five spectral indices are derived and stacked with surface reflectance bands (`SR_B1`–`SR_B5`, `SR_B7` for Landsat 7) to separate mangroves, sand, and water:
   * **NDVI** *(Normalized Difference Vegetation Index)*: `(NIR - Red) / (NIR + Red)` — quantifies vegetation density and health.
   * **NDMI** *(Normalized Difference Moisture Index)*: `(NIR - SWIR) / (NIR + SWIR)` — captures surface and canopy moisture gradients.
   * **MNDWI** *(Modified Normalized Difference Water Index)*: `(Green - SWIR) / (Green + SWIR)` — delineates open ocean and stagnant inland ponds from dry land.
   * **BSI** *(Bare Soil Index)*: `((SWIR + Red) - (NIR + Blue)) / ((SWIR + Red) + (NIR + Blue))` — highlights sand-dominated shorelines and accretion zones.
   * **MVI** *(Mangrove Vegetation Index)*: `(NIR - Green) / (SWIR - Green)` in the script — isolates mangrove stands from terrestrial vegetation.
3. **Supervised Classification & Refinement:** Training samples are split **70% for training and 30% for validation** (`randomColumn()`). A **Random Forest** classifier (`ee.Classifier.smileRandomForest(500)` in the GEE script; 100-tree baseline in the report) predicts land cover classes, evaluated via confusion matrices (Overall Accuracy, Kappa Coefficient, User's Accuracy, and Producer's Accuracy). A **3×3 square focal mode filter** (`ee.Kernel.square({radius: 1})`) removes isolated pixel noise.
4. **Water Quality (Turbidity) Assessment:** The **Normalized Difference Turbidity Index (NDTI)**—computed as `(Red - Green) / (Red + Green)` (`(SR_B3 - SR_B2) / (SR_B3 + SR_B2)` on Landsat 7)—is masked exclusively to **Class 3 (Water)** to track relative water clarity versus murky, stagnant conditions without land-pixel contamination.
5. **Sand Accretion & Hydrological Field Assessment:** DEM differencing (`ALOS - SRTM`), coastline geodesic distance calculations, and on-site channel surveys identify blocked tidal pathways and candidate excavation corridors.

---

## Workflow

1. **Gather Epoch Reference Points:** Digitize balanced sample points ($\ge 30$ per class) in **Google Earth Pro** for 2007–2022 or import **KoboCollect** field points for 2025, assigning class labels (`1` Mangrove, `2` Bareland, `3` Water).
2. **Configure Epoch Dates & ROI:** Update `start_date` and `end_date` (e.g., `2006-01-01` to `2008-12-31` for 2007), load the study area geometry, and generate the median composite.
3. **Compute Indices & Inspect Statistics:** Calculate `NDVI`, `NDMI`, `MNDWI`, `BSI`, and `MVI`, log min/max band statistics across `roi`, and visualize layers on the GEE Map.
4. **Train, Validate & Smooth:** Sample the predictor stack, run the 70/30 train/test split, train the Random Forest model, print accuracy metrics to the Console, and apply the 3×3 `focal_mode` cleanup.
5. **Mask Turbidity & Export Outputs:** Compute `NDTI`, mask it with `classified.eq(3)`, and export both the classified raster (`lc_2007`) and water turbidity layer (`water_quality_ndti_2007`) as GeoTIFFs to Google Drive (`Ugwana_beach_data`) for QGIS mapping and visualization in the **React + Tailwind CSS Mangrove & Creek Rehabilitation Dashboard**.

---

## Results

### Land Cover Area Coverage Across Epochs (2007–2025)

| Land Cover Class | 2007 (ha / km²) | 2012 (ha / km²) | 2017 (ha / km²) | 2022 (ha / km²) | 2025 (ha / km²) |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Forest (Mangrove)** | 45 ha (`0.45 km²`) | 62 ha (`0.62 km²`) | 58 ha (`0.58 km²`) | 38 ha (`0.38 km²`) | 61 ha (`0.61 km²`) |
| **Bareland** | 171 ha (`1.71 km²`) | 130 ha (`1.30 km²`) | 241 ha (`2.41 km²`) | 143 ha (`1.43 km²`) | 82 ha (`0.82 km²`) |
| **Water** | 193 ha (`1.93 km²`) | 217 ha (`2.17 km²`) | 110 ha (`1.10 km²`) | 228 ha (`2.28 km²`) | 278 ha (`2.78 km²`) |
| **Prosopis (*P. juliflora*)** | — | — | — | — | 56 ha (`0.56 km²`) |
| **Mixed Vegetation** | — | — | — | — | 3 ha (`0.03 km²`) |

### Key Findings from Remote Sensing & Fieldwork

* **Vegetation & Bareland Dynamics:** Mangrove cover rose from **45 ha** in 2007 to **62 ha** in 2012, declined to **38 ha** by 2022 amid peak bareland expansion (**241 ha** in 2017) and stagnant water buildup, and recovered to **61 ha** in 2025—accompanied by the notable emergence of **56 ha of invasive *Prosopis juliflora*** (`13.19%` on the 2025 rehabilitation dashboard) along drier inland margins.
* **Surface Water & Turbidity (`NDTI`):** Surface water expanded to **278 ha** by 2025, driven in part by trapped inland water pooling behind accreted beach sand. `NDTI` mapping separated clearer coastal waters (lower values, down to `-0.13`) from higher-turbidity, stagnant ponded areas (`> 0.02`–`0.03`).
* **Hydrological Blockages & Restoration Plan:** Field surveys confirmed that sand buildup blocks the channel connecting the larger **Southern Pond** to the **Northern Pond** (which sit at an elevation difference of roughly **1 ft / 30 cm**) as well as the northern exit channels. Approximately **250 m** of targeted community-led channel excavation—**~130 m** in the lower connecting channel and **~120 m** in the northern exit channels—was mapped to restore daily tidal flushing.
 
---


