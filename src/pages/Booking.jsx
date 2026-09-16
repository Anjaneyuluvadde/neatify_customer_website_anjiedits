import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { FiArrowLeft, FiX, FiSearch } from "react-icons/fi";
import { supabase } from "../components/supabaseClient";
import Header from "../components/SampleHeader";
import { useToast } from "../components/Toast/ToastContext";
import { parseDurationToMinutes, formatDuration } from "../utils/durationUtils";

import "./Booking.css";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const FULL_DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const YEARS = [2026, 2027, 2028];

const today = new Date();

/* ================= DATE CHECK ================= */
const isPastDate = (y, m, d) => {
  const date = new Date(y, m, d);
  const base = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return date < base;
};

/* ================= TIME PARSER ================= */
const timeToMinutes = (timeStr) => {
  if (!timeStr) return 0;
  const normalized = String(timeStr).toLowerCase().trim();
  const isPm = normalized.includes("pm");
  const timePart = normalized.replace(/[ap]m/g, "").trim();
  if (!timePart) return 0;

  let [h, m] = timePart.split(":").map(Number);
  m = m || 0;

  if (isPm && h !== 12) h += 12;
  if (!isPm && h === 12) h = 0;

  return h * 60 + m;
};

/* ================= TIME CHECK ================= */
const isPastTime = (time, y, m, d) => {
  const now = new Date();
  const slotMinutes = timeToMinutes(time);
  const slotTime = new Date(y, m, d, Math.floor(slotMinutes / 60), slotMinutes % 60);
  return slotTime <= now;
};

/* ================= BLOCK NEXT 1.5 HOURS FROM NOW ================= */
const isWithinNext90Minutes = (time, y, m, d) => {
  const now = new Date();
  const slotMinutes = timeToMinutes(time);
  const slotTime = new Date(y, m, d, Math.floor(slotMinutes / 60), slotMinutes % 60);
  return slotTime < new Date(now.getTime() + 90 * 60 * 1000);
};

/* ================= CALENDAR ================= */
const getCalendarMatrix = (year, month) => {
  const firstDay = new Date(year, month, 1).getDay(); // 0 = Sun, 1 = Mon, etc.
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = [];
  // Shift index so Monday is 0, Sunday is 6
  const emptyCells = firstDay === 0 ? 6 : firstDay - 1;
  for (let i = 0; i < emptyCells; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
};

/* ================= PRICE ================= */
const getCurrency = (value) => {
  if (!value) return "₹"; // Fallback
  const match = String(value).match(/^([^\d\s]+)/);
  return match ? match[1] : "₹";
};

const formatPrice = (value) =>
  Number(String(value || "").replace(/[^\d]/g, ""));

const formatTotalAddress = (data, fallbackParts) => {
  if (data.display_name) {
    const rawParts = data.display_name.split(",").map(p => p.trim());
    const uniqueParts = [];
    const seen = new Set();

    for (const p of rawParts) {
      const lowP = p.toLowerCase();
      if (/^\d{6}$/.test(p)) continue;
      const noiseMarkers = ["mandal", "ward", "department"];
      if (noiseMarkers.some(m => lowP.includes(m))) continue;

      if (!seen.has(lowP)) {
        uniqueParts.push(p);
        seen.add(lowP);
      }
    }

    const result = uniqueParts.join(", ");
    if (result) return result;
  }
  const fallback = (fallbackParts || []).filter(Boolean).join(", ");
  return fallback || "Pinned Location";
};

const normalizeCategory = (catStr) => {
  if (!catStr) return "";
  let c = String(catStr).toUpperCase().trim().replace(/_/g, " ");
  if (c.includes("BATHROOM")) return "BATHROOM";
  if (c.includes("KITCHEN UTENSIL") || c.includes("UTENSIL")) return "KITCHEN_UTENSIL_CLEANING";
  if (c.includes("KITCHEN")) return "KITCHEN";
  if (c.includes("DEEP CLEANING")) return "DEEP CLEANING";
  if (c.includes("BALCONY")) return "BALCONY CLEANING";
  if (c.includes("CLOTHES FOLDING") || c.includes("FOLDING")) return "CLOTHES_FOLDING";
  if (c.includes("CLOTHES IRONING") || c.includes("IRONING")) return "CLOTHES_IRONING";
  if (c.includes("FLOOR MOPPING") || c.includes("MOPPING")) return "FLOOR_MOPPING";
  return c;
};

export default function Booking({ user }) {

  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();
  const [selectedServices, setSelectedServices] = useState(location.state?.services || []);
  const [serviceTimeRules, setServiceTimeRules] = useState([]);

  /* ================= ADD-ONS STATE ================= */
  const [addOns, setAddOns] = useState([]);
  const [showAddService, setShowAddService] = useState(false);
  const [showAddOnDetail, setShowAddOnDetail] = useState(false);
  const [selectedAddOn, setSelectedAddOn] = useState(null);
  const [times, setTimes] = useState([]);
  const [timeSlotsConfig, setTimeSlotsConfig] = useState([]);
  const [dateTimeSlotsConfig, setDateTimeSlotsConfig] = useState({});

  /* ================= LOCATION SELECTOR STATE ================= */
  const [selectedPincode, setSelectedPincode] = useState("");
  const [selectedHubName, setSelectedHubName] = useState("");
  const [selectedAddress, setSelectedAddress] = useState("");
  const [isAddressSummaryMode, setIsAddressSummaryMode] = useState(false);
  const [hasUsedLocationFetch, setHasUsedLocationFetch] = useState(false);
  const [latitude, setLatitude] = useState(17.4399); // Default Hyderabad
  const [longitude, setLongitude] = useState(78.4983);
  const [isPincodeServiceable, setIsPincodeServiceable] = useState(true);
  const [isFetchingLocation, setIsFetchingLocation] = useState(false);
  const [showMapPickerModal, setShowMapPickerModal] = useState(false);

  const resolveHubFromLocation = useCallback(async (pinStr, addressStr = "") => {
    const cleanPin = String(pinStr || "").replace(/\D/g, "").slice(0, 6);

    // 1. Match by pincode in hub_locations table (support multiple rows per pincode!)
    if (cleanPin.length === 6) {
      const { data: pinLocs, error } = await supabase
        .from("hub_locations")
        .select("hub_name, location_name, is_active")
        .eq("pincode", cleanPin);

      if (!error && pinLocs && pinLocs.length > 0) {
        // If an address is provided, try matching specific location_name
        if (addressStr) {
          const addrUpper = addressStr.toUpperCase();
          const specificMatch = pinLocs.find((hl) => {
            const locName = (hl.location_name || "").toUpperCase().trim();
            return locName && addrUpper.includes(locName);
          });
          if (specificMatch) {
            return { hubName: specificMatch.hub_name, isActive: specificMatch.is_active !== false };
          }
        }

        // Return first active location match for this pincode
        const activeMatch = pinLocs.find(hl => hl.is_active !== false) || pinLocs[0];
        return { hubName: activeMatch.hub_name, isActive: activeMatch.is_active !== false };
      }
    }

    // 2. Fallback: Match by location_name or address substring in hub_locations table
    if (addressStr) {
      const addrUpper = addressStr.toUpperCase();
      const { data: allHubLocs } = await supabase
        .from("hub_locations")
        .select("hub_name, location_name, pincode, is_active");

      if (allHubLocs && allHubLocs.length > 0) {
        const match = allHubLocs.find((hl) => {
          const locName = (hl.location_name || "").toUpperCase().trim();
          return locName && addrUpper.includes(locName);
        });

        if (match) {
          return { hubName: match.hub_name, isActive: match.is_active !== false };
        }
      }
    }

    return { hubName: null, isActive: false };
  }, []);

  const fetchHubCategoryStaffCount = useCallback(async (hubName, servicesList) => {
    if (!hubName || !servicesList || servicesList.length === 0) return 0;

    const firstService = servicesList[0];
    let rawType = (firstService?.service_type || firstService?.category || firstService?.title || "").toUpperCase().trim();

    if (!rawType && firstService?.id) {
      try {
        const { data: sRow } = await supabase
          .from("services")
          .select("service_type, category")
          .eq("id", firstService.id)
          .maybeSingle();

        if (sRow) {
          rawType = (sRow.service_type || sRow.category || "").toUpperCase().trim();
        }
      } catch (e) {
        console.error("Error fetching service_type from DB:", e);
      }
    }

    if (!rawType) return 0;

    const normalizedTarget = normalizeCategory(rawType);
    const spaceType = rawType.replace(/_/g, " ").trim();
    const underscoreType = rawType.replace(/\s+/g, "_").trim();

    let mappedSpaceType = spaceType;
    if (mappedSpaceType === "KITCHEN CLEANING") mappedSpaceType = "KITCHEN";
    if (mappedSpaceType === "FULL HOME DEEP CLEANING") mappedSpaceType = "DEEP CLEANING";

    try {
      // Filter rows by hub = hubName in hub_category_counts table
      const { data: rows } = await supabase
        .from("hub_category_counts")
        .select("count, category, hub")
        .ilike("hub", hubName.trim());

      if (!rows || rows.length === 0) return 0;

      // Step 1: Canonical normalized category match (Strict exact category token match)
      let match = rows.find((r) => {
        const catNorm = normalizeCategory(r.category);
        return catNorm === normalizedTarget;
      });

      // Step 2: Strict raw string equality as secondary check
      if (!match) {
        match = rows.find((r) => {
          const cat = (r.category || "").toUpperCase().trim();
          return (
            cat === rawType ||
            cat === spaceType ||
            cat === underscoreType ||
            cat === mappedSpaceType
          );
        });
      }

      // Step 3: Strict word boundary fallback match (never matching substrings like KITCHEN inside KITCHEN_UTENSIL_CLEANING)
      if (!match) {
        match = rows.find((r) => {
          const cat = (r.category || "").toUpperCase().trim();
          const regex = new RegExp(`\\b${rawType.replace(/[^A-Z0-9]/g, "")}\\b`, "i");
          const cleanCat = cat.replace(/[^A-Z0-9]/g, "");
          return regex.test(cleanCat) && cleanCat === rawType.replace(/[^A-Z0-9]/g, "");
        });
      }

      if (match && match.count !== null && match.count !== undefined) {
        return Number(match.count);
      }
      return 0;
    } catch (e) {
      console.error("Error fetching hub category count:", e);
      return 0;
    }
  }, []);

  const verifyPincodeServiceability = useCallback(async (pinStr, addressStr = "") => {
    const cleanPin = String(pinStr || "").trim();
    
    // Step 1: Query hub_locations using pincode/address and check is_active
    const { hubName, isActive } = await resolveHubFromLocation(cleanPin, addressStr || selectedAddress);

    if (!hubName || !isActive) {
      setSelectedHubName(hubName || "");
      setIsPincodeServiceable(false);
      setCategoryStaffCount(0);
      return false;
    }

    setSelectedHubName(hubName);

    // Step 2 & 3 & 4: Query hub_category_counts using hub_name and category to get count
    const count = await fetchHubCategoryStaffCount(hubName, selectedServices);
    setCategoryStaffCount(count);

    if (count > 0) {
      setIsPincodeServiceable(true);
      return true;
    } else {
      setIsPincodeServiceable(false);
      return false;
    }
  }, [selectedServices, fetchHubCategoryStaffCount, selectedAddress, resolveHubFromLocation]);

  const handleMapConfirm = async (pickedData) => {
    if (!pickedData) return;
    
    let addr = pickedData.address || "";
    let cleanZip = String(pickedData.zip || "").replace(/\D/g, "").slice(0, 6);
    
    if (!cleanZip && addr) {
      const match = addr.match(/\b\d{6}\b/);
      if (match) cleanZip = match[0];
    }

    if (addr) setSelectedAddress(addr);
    if (pickedData.lat && pickedData.lng) {
      setLatitude(pickedData.lat);
      setLongitude(pickedData.lng);
    }

    if (cleanZip) {
      setSelectedPincode(cleanZip);
      verifyPincodeServiceability(cleanZip);
    } else if (addr) {
      const { hubName, isActive } = await resolveHubFromLocation("", addr);
      if (hubName && isActive) {
        const { data: locRow } = await supabase
          .from("hub_locations")
          .select("pincode")
          .ilike("hub_name", `%${hubName}%`)
          .limit(1)
          .maybeSingle();

        if (locRow && locRow.pincode) {
          const foundPin = String(locRow.pincode).trim();
          setSelectedPincode(foundPin);
          verifyPincodeServiceability(foundPin);
        }
      }
    }

    setShowMapPickerModal(false);
    toast.success("Location pinned successfully!");
  };

  const hasInitializedLocationRef = useRef(false);

  useEffect(() => {
    if (hasInitializedLocationRef.current) return;
    hasInitializedLocationRef.current = true;

    const initLocation = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const currentUser = user || session?.user;

        if (currentUser?.id) {
          const { data: profData } = await supabase
            .from("profile")
            .select("pincode, address")
            .eq("id", currentUser.id)
            .maybeSingle();

          if (profData) {
            if (profData.address) setSelectedAddress(profData.address);
            if (profData.pincode) {
              const cleanPin = String(profData.pincode).trim();
              setSelectedPincode(cleanPin);
              verifyPincodeServiceability(cleanPin);
              return;
            }
          }
        }

        const { data: firstHub } = await supabase
          .from("hub_locations")
          .select("hub_name, pincode, location_name")
          .eq("is_active", true)
          .limit(1)
          .maybeSingle();

        if (firstHub) {
          setSelectedPincode(firstHub.pincode || "");
          setSelectedHubName(firstHub.hub_name || "");
          setSelectedAddress(firstHub.location_name || `${firstHub.hub_name}, Hyderabad - ${firstHub.pincode}`);
          setIsPincodeServiceable(true);
        }
      } catch (e) {
        console.warn("Init location error:", e);
      }
    };

    initLocation();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const fetchCurrentLocation = () => {
    if (!navigator.geolocation) {
      toast.error("Geolocation is not supported by your browser.");
      return;
    }

    setIsFetchingLocation(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const { latitude: lat, longitude: lon } = position.coords;
          const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`);
          const data = await response.json();

          if (data && data.address) {
            const rawZip = data.address.postcode || "";
            const cleanZip = rawZip.replace(/\D/g, "").slice(0, 6);

            const rawParts = (data.display_name || "").split(",").map(p => p.trim());
            const displayAddress = rawParts.slice(0, 6).join(", ");

            setSelectedAddress(displayAddress);

            if (cleanZip.length === 6) {
              setSelectedPincode(cleanZip);
              verifyPincodeServiceability(cleanZip);
              toast.success(`Location updated! Pincode: ${cleanZip}`);
            } else {
              toast.success("Location fetched!");
            }
          }
        } catch (error) {
          console.error("Geocoding error:", error);
          toast.error("Failed to fetch address details.");
        } finally {
          setIsFetchingLocation(false);
        }
      },
      (error) => {
        setIsFetchingLocation(false);
        let errorMsg = "Geolocation failed.";
        if (error.code === 1) errorMsg = "Location access denied. Please allow access in settings.";
        else if (error.code === 3) errorMsg = "Location request timed out. Try entering pincode manually.";
        toast.error(errorMsg);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };



  const currency = useMemo(() => {
    const firstService = selectedServices[0];
    return getCurrency(firstService?.price || firstService?.original_price);
  }, [selectedServices]);

  const fetchFreshData = useCallback(async () => {
    setSelectedServices((currentServices) => {
      if (currentServices.length === 0) return currentServices;

      const ids = currentServices.map((s) => s.id).filter(Boolean);
      if (ids.length === 0) return currentServices;

      (async () => {
        const { data: servicesData } = await supabase
          .from("services")
          .select("*")
          .in("id", ids);

        const { data: addonsData } = await supabase
          .from("add_ons")
          .select("id, title, duration, price, original_price, discount_percent, image, work_includes, description, work_not_included, service_type, max_quantity")
          .in("id", ids);

        const freshMap = new Map();
        if (servicesData) {
          servicesData.forEach((s) => freshMap.set(s.id, { ...s, isAddon: false }));
        }
        if (addonsData) {
          addonsData.forEach((s) => freshMap.set(s.id, { ...s, isAddon: true }));
        }

        const { data: offersData } = await supabase
          .from("offers")
          .select("*")
          .eq("is_offer_enabled", true)
          .order("created_at", { ascending: false });

        setSelectedServices((prev) =>
          prev.map((s) => {
            const fresh = freshMap.get(s.id);
            if (fresh) {
              const matchingOffer = (offersData || []).find((o) => o.title === fresh.title);

              let finalPrice = fresh.price;
              let finalDiscountPercent = parseFloat(fresh.discount_percent) || 0;
              let finalDiscountLabel =
                (fresh.discount_label ? fresh.discount_label.toUpperCase() : null) ||
                (finalDiscountPercent > 0 ? `${finalDiscountPercent}% OFF` : null);

              if (matchingOffer) {
                const offerPrice = matchingOffer.offer_price || matchingOffer.fixed_price;
                const offerPct = parseFloat(matchingOffer.offer_percentage) || 0;
                const originalPrice = fresh.original_price
                  ? parseFloat(String(fresh.original_price).replace(/[^\d.]/g, ""))
                  : null;

                if (offerPrice !== undefined && offerPrice !== null) {
                  finalPrice = offerPrice;
                } else if (originalPrice && offerPct > 0) {
                  finalPrice = Math.round(originalPrice * (1 - offerPct / 100));
                }

                finalDiscountPercent = offerPct;
                finalDiscountLabel = offerPct > 0 ? `${offerPct}% OFF` : "SPECIAL OFFER";
              }

              return {
                ...s,
                ...fresh,
                price: finalPrice,
                discount_percent: finalDiscountPercent,
                discount_label: finalDiscountLabel,
                quantity: s.quantity,
              };
            }
            return s;
          })
        );
      })();

      return currentServices;
    });
  }, []);

  useEffect(() => {
    supabase
      .from("add_ons")
      .select("id, title, duration, price, original_price, discount_percent, image, work_includes, description, work_not_included, service_type, max_quantity, is_active")
      .eq("is_active", true)
      .order("sort_order", { ascending: true })
      .then(({ data }) => {
        if (data) {
          const firstService = selectedServices[0];
          const rawType = (firstService?.service_type || "").toUpperCase();
          let mappedType = rawType.replace(/_/g, " ").trim();

          if (mappedType === "ADDITIONAL") mappedType = "ADDITIONAL SERVICES";
          if (mappedType === "KITCHEN CLEANING") mappedType = "KITCHEN";
          if (mappedType === "FULL HOME DEEP CLEANING") mappedType = "DEEP CLEANING";

          const filtered = data.filter(
            (addon) => (addon.service_type || "").toUpperCase().trim() === mappedType
          );

          setAddOns(filtered);
        }
      });
  }, [selectedServices]);

  const addService = (svc) => {
    const existing = selectedServices.find((s) => s.id === svc.id);
    if (existing) {
      const limit = existing.max_quantity || 3;
      if (existing.quantity >= limit) {
        toast.error(`You can only add up to ${limit} of this service.`);
        return;
      }

      setSelectedServices((prev) =>
        prev.map((s) =>
          s.id === svc.id ? { ...s, quantity: (s.quantity || 1) + 1 } : s
        )
      );
      return;
    }

    setSelectedServices((prev) => [...prev, { ...svc, quantity: 1, isAddon: true }]);
  };

  const removeService = (id) => {
    setSelectedServices((prev) => {
      const existing = prev.find((s) => s.id === id);
      if (existing && existing.quantity > 1) {
        return prev.map((s) =>
          s.id === id ? { ...s, quantity: s.quantity - 1 } : s
        );
      }
      return prev.filter((s) => s.id !== id);
    });
  };

  useEffect(() => {
    if (showAddService || showAddOnDetail || showMapPickerModal) {
      document.body.classList.add("no-scroll");
    } else {
      document.body.classList.remove("no-scroll");
    }
    return () => document.body.classList.remove("no-scroll");
  }, [showAddService, showAddOnDetail, showMapPickerModal]);

  useEffect(() => {
    fetchFreshData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const fetchServiceRules = async () => {
      try {
        const { data, error } = await supabase
          .from("schedule_config")
          .select("config_value")
          .eq("config_key", "service_time_rules")
          .single();

        if (error) throw error;

        setServiceTimeRules(Array.isArray(data?.config_value) ? data.config_value : []);
      } catch (err) {
        console.error("Error fetching service rules:", err);
      }
    };

    fetchServiceRules();
  }, []);

  useEffect(() => {
    const fetchTimeSlots = async () => {
      try {
        const { data, error } = await supabase
          .from("schedule_config")
          .select("config_value")
          .eq("config_key", "time_slots")
          .single();

        if (error) throw error;

        if (Array.isArray(data?.config_value)) {
          setTimeSlotsConfig(data.config_value);
          const allSlots = (data.config_value || [])
            .map(slot => (typeof slot === "string" ? slot : slot.value))
            .filter(Boolean);
          setTimes(allSlots);
        }
      } catch (err) {
        console.error("Error fetching time slots:", err);
      }
    };

    fetchTimeSlots();
  }, []);

  useEffect(() => {
    const fetchDateTimeSlots = async () => {
      try {
        const { data, error } = await supabase
          .from("schedule_config")
          .select("config_value")
          .eq("config_key", "date_time_slots")
          .single();

        if (error) throw error;
        if (data?.config_value) {
          setDateTimeSlotsConfig(data.config_value);
        }
      } catch (err) {
        console.error("Error fetching date time slots:", err);
      }
    };

    fetchDateTimeSlots();
  }, []);

  const [month, setMonth] = useState(today.getMonth());
  const [year, setYear] = useState(today.getFullYear());
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedTime, setSelectedTime] = useState(null);
  const [dateBookings, setDateBookings] = useState([]);
  const [categoryStaffCount, setCategoryStaffCount] = useState(0);

  /* ================= FETCH STAFF CAPACITY & CATEGORY SERVICEABILITY FOR HUB ================= */
  useEffect(() => {
    const updateCategoryServiceability = async () => {
      if (selectedServices && selectedServices.length > 0) {
        const { hubName, isActive } = await resolveHubFromLocation(selectedPincode, selectedAddress);
        if (!hubName || !isActive) {
          setSelectedHubName(hubName || "");
          setCategoryStaffCount(0);
          setIsPincodeServiceable(false);
          return;
        }

        setSelectedHubName(hubName);
        const count = await fetchHubCategoryStaffCount(hubName, selectedServices);
        setCategoryStaffCount(count);
        setIsPincodeServiceable(count > 0);
      }
    };
    updateCategoryServiceability();
  }, [selectedHubName, selectedServices, selectedPincode, selectedAddress, fetchHubCategoryStaffCount, resolveHubFromLocation]);

  /* ================= FETCH BOOKINGS FOR SELECTED DATE ================= */
  useEffect(() => {
    if (!selectedDate) {
      setDateBookings([]);
      return;
    }

    const fetchDateBookings = async () => {
      try {
        const dStr = String(selectedDate).padStart(2, "0");
        const mStr = String(month + 1).padStart(2, "0");
        const dateString = `${year}-${mStr}-${dStr}`;

        const { data: bData, error } = await supabase
          .from("bookings")
          .select("*");

        if (error) {
          console.error("Error fetching date bookings from Supabase:", error);
          return;
        }

        const active = (bData || []).filter((b) => {
          const ws = String(b.work_status || "").toUpperCase();
          const ps = String(b.payment_status || "").toUpperCase();
          if (ws === "CANCELLED" || ps === "FAILED") return false;

          const bDateStr = String(b.booking_date || "").trim();
          return bDateStr.includes(dateString) || bDateStr === dateString;
        });

        setDateBookings(active);
      } catch (err) {
        console.error("Error fetching bookings:", err);
      }
    };

    fetchDateBookings();
  }, [selectedDate, month, year]);

  const availableTimes = useMemo(() => {
    let list = [...times];
    if (selectedDate) {
      const dateString = `${year}-${String(month + 1).padStart(2, "0")}-${String(selectedDate).padStart(2, "0")}`;
      const customTimes = dateTimeSlotsConfig[dateString] || [];
      const customStrings = customTimes
        .map(slot => (typeof slot === "string" ? slot : slot.value))
        .filter(Boolean);
      list = Array.from(new Set([...list, ...customStrings]));
    }
    return list.sort((a, b) => timeToMinutes(a) - timeToMinutes(b));
  }, [selectedDate, month, year, dateTimeSlotsConfig, times]);

  const isDefaultSlotDisabled = useCallback((timeStr) => {
    const config = timeSlotsConfig.find(slot => 
      (typeof slot === "string" && slot === timeStr) || 
      (typeof slot === "object" && slot && slot.value === timeStr)
    );
    return config && typeof config === "object" && config.active === false;
  }, [timeSlotsConfig]);

  /* ================= 3D TILT EFFECT ================= */
  const calendarRef = useRef(null);

  const handleMouseMove = useCallback((e) => {
    if (!calendarRef.current) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const rotateY = (x - 0.5) * 12;

    calendarRef.current.style.transform = `perspective(1000px) rotateY(${rotateY}deg)`;
    calendarRef.current.style.transition = 'transform 0.1s ease-out';
  }, []);

  const handleMouseLeave = useCallback(() => {
    if (!calendarRef.current) return;
    calendarRef.current.style.transform = `perspective(1000px) rotateY(0deg)`;
    calendarRef.current.style.transition = 'transform 0.4s cubic-bezier(0.2, 0, 0.4, 1)';
  }, []);

  const CALENDAR = getCalendarMatrix(year, month);
  const selectedServiceCategoryNorm = useMemo(() => {
    const firstService = selectedServices[0];
    return normalizeCategory(
      firstService?.service_type || firstService?.category || firstService?.title
    );
  }, [selectedServices]);

  const selectedServiceRule = useMemo(() => {
    if (!selectedServiceCategoryNorm || !serviceTimeRules || serviceTimeRules.length === 0) return null;
    return serviceTimeRules.find((rule) => {
      const rCategoryNorm = normalizeCategory(rule.service_name || rule.service || rule.category);
      return rCategoryNorm && rCategoryNorm === selectedServiceCategoryNorm;
    }) || null;
  }, [selectedServiceCategoryNorm, serviceTimeRules]);

  const isTimeDisabledByService = (time) => {
    if (!selectedServiceRule || !selectedServiceRule.last_booking_time) return false;

    return (
      timeToMinutes(time) >
      timeToMinutes(selectedServiceRule.last_booking_time)
    );
  };

  const totalDurationMinutes = selectedServices.reduce(
    (sum, s) => sum + parseDurationToMinutes(s.duration) * (s.quantity || 1),
    0
  );

  /* ================= CAPACITY & TIME SLOT AVAILABILITY CHECK ================= */
  const isSlotDisabledByCapacity = useCallback(
    (timeStr) => {
      if (categoryStaffCount <= 0) return true;

      if (!dateBookings || dateBookings.length === 0) return false;

      const firstService = selectedServices[0];
      const selectedCategoryNorm = normalizeCategory(
        firstService?.service_type || firstService?.category || firstService?.title
      );

      const candidateStart = timeToMinutes(timeStr);
      const newDuration = totalDurationMinutes || 45;
      const candidateEnd = candidateStart + newDuration + 60; // candidate service duration + 1 hr buffer

      // 1. Filter active dateBookings matching the selected service category
      const categoryBookings = dateBookings.filter((b) => {
        // ✅ Cross-Hub Fix: Only count bookings from the exact same Hub
        const bHubName = (b.hub_name || "").toUpperCase().trim();
        const sHubName = (selectedHubName || "").toUpperCase().trim();
        if (sHubName && bHubName && bHubName !== sHubName) {
          return false;
        }

        let bServices = [];
        if (b.services) {
          try {
            bServices = typeof b.services === "string" ? JSON.parse(b.services) : b.services;
          } catch (e) {}
        }
        const bFirst = Array.isArray(bServices) && bServices.length > 0 ? bServices[0] : null;
        const bCategoryNorm = normalizeCategory(
          bFirst?.service_type || bFirst?.category || bFirst?.title
        );

        if (selectedCategoryNorm && bCategoryNorm && selectedCategoryNorm !== bCategoryNorm) {
          return false;
        }
        return true;
      });

      if (categoryBookings.length === 0) return false;

      // 2. Build time intervals for existing category bookings [bStart, bEnd)
      const bookedWindows = categoryBookings.map((b) => {
        let bDur = parseDurationToMinutes(b.total_duration || b.service_duration);
        if (!bDur && b.services) {
          try {
            const parsed = typeof b.services === "string" ? JSON.parse(b.services) : b.services;
            if (Array.isArray(parsed) && parsed.length > 0) {
              bDur = parsed.reduce((acc, s) => acc + (parseDurationToMinutes(s.duration) || 45) * (s.quantity || 1), 0);
            }
          } catch (e) {}
        }
        bDur = bDur || 45;

        const bStart = timeToMinutes(b.booking_time);
        const bEnd = bStart + bDur + 60; // service duration + 1 hr buffer
        return { start: bStart, end: bEnd };
      });

      // 3. Check if adding candidate interval [candidateStart, candidateEnd) at any minute
      // causes active staff count to reach or exceed categoryStaffCount
      for (let m = candidateStart; m < candidateEnd; m += 15) {
        let occupiedStaffAtM = 0;
        for (const w of bookedWindows) {
          if (m >= w.start && m < w.end) {
            occupiedStaffAtM++;
          }
        }
        if (occupiedStaffAtM >= categoryStaffCount) {
          return true; // Slot is DISABLED because staff capacity is exceeded during candidate interval!
        }
      }

      return false; // Slot is ENABLED
    },
    [dateBookings, categoryStaffCount, totalDurationMinutes, selectedServices, selectedHubName]
  );

  const selectedDayName = selectedDate
    ? FULL_DAYS[new Date(year, month, selectedDate).getDay()]
    : "";

  const totalAmount = selectedServices.reduce(
    (sum, s) => sum + formatPrice(s.price) * (s.quantity || 1),
    0
  );

  const originalTotalAmount = selectedServices.reduce(
    (sum, s) => sum + formatPrice(s.original_price) * (s.quantity || 1),
    0
  );

  const discountPercent = selectedServices[0]?.discount_percent || 0;

  return (
    <>
      <Header user={user} />

      <div className="booking-container">
        {!(showAddService || showAddOnDetail) && (
          <button
            className="back-btn-center-left"
            onClick={() => navigate(-1)}
            title="Go Back"
          >
            <FiArrowLeft size={22} />
          </button>
        )}

        <div className="booking-layout">
          <div className="calendar-section">
            {/* ================= LOCATION CARD (EXACT IMAGE FORMAT MATCH) ================= */}
            <div className="location-card-container">
              {isAddressSummaryMode && hasUsedLocationFetch ? (
                <div className="location-summary-card" style={{ padding: '16px', background: '#f8fafc', borderRadius: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', border: '1px solid #e2e8f0' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid #e2e8f0' }}>
                      📍
                    </div>
                    <div>
                      <div style={{ fontSize: '12px', color: '#64748b', fontWeight: '600' }}>Selected Location</div>
                      <div style={{ fontSize: '14px', color: '#0f172a', fontWeight: '500', marginTop: '2px' }}>
                        {selectedAddress || selectedPincode ? `${selectedAddress}${selectedPincode ? " - " + selectedPincode : ""}` : "No Address Provided"}
                      </div>
                    </div>
                  </div>
                  <button 
                    onClick={() => setIsAddressSummaryMode(false)}
                    style={{ background: '#fff', border: '1px solid #e2e8f0', padding: '6px 12px', borderRadius: '6px', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}
                  >
                    Edit
                  </button>
                </div>
              ) : (
                <>
                  <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div style={{ background: '#fff', width: '90%', maxWidth: '400px', borderRadius: '16px', padding: '24px', boxShadow: '0 10px 25px rgba(0,0,0,0.1)', position: 'relative' }}>
                      <h3 style={{ margin: '0 0 20px 0', fontSize: '18px' }}>Service Address</h3>
                      
                      <div className="location-field-group">
                        <label className="location-field-label">
                          Full Address (House No, Building, Area) *
                        </label>
                        <textarea
                          className="location-address-input"
                          rows={3}
                          placeholder="Plot No, Flat No, Building Name, Area, City"
                          value={selectedAddress}
                          onChange={(e) => setSelectedAddress(e.target.value)}
                        />
                      </div>

                      <div className="location-field-group" style={{ marginTop: "16px" }}>
                        <label className="location-field-label">Pincode *</label>
                        <input
                          type="text"
                          maxLength={6}
                          className="location-pincode-input"
                          placeholder="500090"
                          value={selectedPincode}
                          onChange={(e) => {
                            const cleanPin = e.target.value.replace(/\D/g, "");
                            setSelectedPincode(cleanPin);
                            if (cleanPin.length === 6) {
                              verifyPincodeServiceability(cleanPin);
                            } else {
                              setIsPincodeServiceable(false);
                            }
                          }}
                        />
                      </div>

                      {/* ================= ACTION BUTTONS ROW ================= */}
                      <div className="location-actions-row" style={{ marginTop: '20px', gap: '10px' }}>
                        <button
                          type="button"
                          className="btn-use-my-location"
                          style={{ flex: 1, padding: '10px', fontSize: '13px' }}
                          disabled={isFetchingLocation}
                          onClick={fetchCurrentLocation}
                        >
                          📍 {isFetchingLocation ? "Fetching..." : "Use Location"}
                        </button>
                        <button
                          type="button"
                          className="btn-pick-on-map"
                          style={{ flex: 1, padding: '10px', fontSize: '13px' }}
                          onClick={() => setShowMapPickerModal(true)}
                        >
                          🗺️ Map
                        </button>
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '24px', gap: '12px' }}>
                        {hasUsedLocationFetch && (
                          <button 
                            onClick={() => setIsAddressSummaryMode(true)}
                            style={{ background: 'transparent', border: 'none', padding: '10px', fontWeight: '600', cursor: 'pointer' }}
                          >
                            Cancel
                          </button>
                        )}
                        <button 
                          onClick={() => {
                            setIsAddressSummaryMode(true);
                            setHasUsedLocationFetch(true);
                          }}
                          style={{ background: '#F4C430', border: 'none', padding: '10px 20px', borderRadius: '8px', fontWeight: '700', cursor: 'pointer' }}
                        >
                          Save Address
                        </button>
                      </div>
                    </div>
                  </div>
                </>
              )}

              {/* ================= SERVICE NOT AVAILABLE ALERT ================= */}
              {selectedPincode.length === 6 && !isPincodeServiceable && (
                <div className="service-not-available-alert" style={{ marginTop: '16px' }}>
                  <div className="alert-icon-circle">✕</div>
                  <div className="alert-text-stack">
                    <strong>Service Not Available</strong>
                    <span>We will be available soon in your area.</span>
                  </div>
                </div>
              )}
            </div>

            <h1>Schedule Your Service</h1>
            <p className="subtitle">Choose a date and time that works best for you.</p>

            <div className="row">
              <div className="month-year">
                <select value={month} onChange={(e) => {
                  setMonth(+e.target.value);
                  setSelectedDate(null);
                  setSelectedTime(null);
                }}>
                  {MONTHS.map((m, i) => <option key={m} value={i}>{m}</option>)}
                </select>

                <select value={year} onChange={(e) => {
                  setYear(+e.target.value);
                  setSelectedDate(null);
                  setSelectedTime(null);
                }}>
                  {YEARS.map((y) => <option key={y}>{y}</option>)}
                </select>
              </div>
            </div>

            <div className="scheduler-row">
              <div
                className="calendar-tilt-wrapper"
                onMouseMove={handleMouseMove}
                onMouseLeave={handleMouseLeave}
              >
                <div
                  className="calendar-grid"
                  key={`${month}-${year}`}
                  ref={calendarRef}
                >
                  {DAYS.map((d) => <div key={d} className="day-label">{d}</div>)}

                  {CALENDAR.map((d, i) =>
                    d ? (
                      <button
                        key={i}
                        style={{ "--i": i }}
                        className={`date ${selectedDate === d ? "selected" : ""}`}
                        disabled={isPastDate(year, month, d)}
                        onClick={() => {
                          setSelectedDate(d);
                          setSelectedTime(null);
                        }}
                      >
                        {d}
                      </button>
                    ) : <div key={i} style={{ "--i": i }} className="empty" />
                  )}
                </div>
              </div>

                  {selectedDate && (
                <div className="time-section">
                  <h4>Available Timings</h4>
                  <div className="time-grid" key={`${year}-${month}-${selectedDate}`}>
                    {availableTimes.map((t, idx) => {
                      const isToday =
                        year === today.getFullYear() &&
                        month === today.getMonth() &&
                        selectedDate === today.getDate();

                      const slotMinutes = timeToMinutes(t);
                      const selectedMinutes = selectedTime
                        ? timeToMinutes(selectedTime)
                        : null;

                      const dateString = `${year}-${String(month + 1).padStart(2, "0")}-${String(selectedDate).padStart(2, "0")}`;
                      const hasCustomTimes = !!dateTimeSlotsConfig[dateString];
                      
                      let isAdminDisabled = false;
                      if (hasCustomTimes) {
                        const customTimesForDate = dateTimeSlotsConfig[dateString] || [];
                        const activeCustomTimes = customTimesForDate
                          .filter(slot => slot && (typeof slot === "string" || slot.active !== false))
                          .map(slot => (typeof slot === "string" ? slot : slot.value))
                          .filter(Boolean);
                        
                        isAdminDisabled = !activeCustomTimes.includes(t);
                      } else {
                        isAdminDisabled = isDefaultSlotDisabled(t);
                      }

                      const disabled =
                        isAdminDisabled || // ✅ Admin removed/disabled slot
                        isTimeDisabledByService(t) || // ✅ Service rule condition
                        isSlotDisabledByCapacity(t) || // ✅ Staff capacity & Bidirectional +1hr buffer
                        (isToday &&
                          (
                            isPastTime(t, year, month, selectedDate) ||
                            isWithinNext90Minutes(t, year, month, selectedDate)
                          )) ||
                        (
                          selectedTime === "3:00 pm" &&
                          slotMinutes > selectedMinutes &&
                          slotMinutes <= selectedMinutes + 90
                        );

                      return (
                        <button
                          key={t}
                          disabled={disabled}
                          className={`time-box 
                            ${selectedTime === t ? "selected-time" : ""} 
                            ${disabled ? "disabled-time" : ""}`}
                          style={{ "--i": idx }}
                          onClick={() => !disabled && setSelectedTime(t)}
                        >
                          {t}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="summary">
            <h3>Service Details</h3>

            <div className="services-wrapper">
              {selectedServices.map((s, i) => (
                <div key={i} className="service-item">
                  <div className="summary-item-title-row">
                    <strong>{s.title || s.name}</strong>
                    {s.quantity > 1 && (
                      <span className="qty-badge">x{s.quantity}</span>
                    )}
                  </div>
                  <p className="summary-item-duration">
                    {formatDuration(s.duration)}
                  </p>
                  <div className="summary-item-price-row">
                    {s.original_price && (
                      <span className="mrp">
                        {getCurrency(s.original_price)}{formatPrice(s.original_price)}
                      </span>
                    )}
                    <span className="summary-item-price">
                      {getCurrency(s.price)}{formatPrice(s.price)}
                    </span>
                    {(s.discount_label || s.discount_percent > 0 || (s.original_price && s.price)) && (
                      <span className="offer-badge">
                        {(() => {
                          const calculatedPct = (s.original_price && s.price)
                            ? Math.round((1 - parseFloat(String(s.price).replace(/[^\d.]/g, "")) / parseFloat(String(s.original_price).replace(/[^\d.]/g, ""))) * 100)
                            : 0;

                          if (s.isAddon) {
                            if (calculatedPct > 0) return `${calculatedPct}% OFF`;
                            if (s.discount_percent > 0) return `${s.discount_percent}% OFF`;
                            return s.discount_label || "SPECIAL OFFER";
                          }

                          if (s.discount_label) return s.discount_label;
                          if (calculatedPct > 0) return `${calculatedPct}% OFF`;
                          return "SPECIAL OFFER";
                        })().toUpperCase()}
                      </span>
                    )}
                  </div>
                  {s.isAddon && (
                    <div className="service-item-actions">
                      <button
                        className="remove-btn"
                        onClick={() => removeService(s.id)}
                      >
                        Remove
                      </button>
                    </div>
                  )}
                </div>
              ))}

              {addOns.length > 0 && (
                <button
                  className="add-more-services-btn"
                  onClick={() => setShowAddService(true)}
                >
                  +add ons
                </button>
              )}
            </div>

            {/* ✅ BOOKING DETAILS ADDED */}
            {selectedDate && selectedTime && (
              <div className="booking-details">
                <p>
                  <strong>Booking:</strong>{" "}
                  {selectedDayName}, {selectedDate} {MONTHS[month]} {year} at {selectedTime}
                </p>
              </div>
            )}

            <div className="total-row">
              <span>Total Duration</span>
              <strong>{totalDurationMinutes} mins</strong>
            </div>

            <div className="total-amount-row-premium">
              <span className="total-label">Total Amount</span>
              <div className="total-price-stack">
                {originalTotalAmount > totalAmount && (
                  <span className="total-price-mrp">{currency}{originalTotalAmount}</span>
                )}
                <strong className="total-price-main">{currency}{totalAmount.toFixed(2)}</strong>
                <span className="total-offer-badge">
                  {selectedServices[0]?.discount_label ||
                    (discountPercent > 0
                      ? `${discountPercent}% OFF`
                      : "SPECIAL OFFER")}
                </span>
              </div>
            </div>

            <button
              className="next-btn"
              disabled={!(selectedDate && selectedTime && selectedServices.length) || (selectedPincode.length === 6 && !isPincodeServiceable)}
              onClick={() =>
                navigate("/payment", {
                  state: {
                    services: selectedServices,
                    date: selectedDate,
                    time: selectedTime,
                    month,
                    year,
                    total: totalAmount,
                    duration: totalDurationMinutes,
                    pincode: selectedPincode,
                    hub: selectedHubName,
                    address: selectedAddress,
                  },
                })
              }
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {/* MOBILE STICKY FOOTER */}
      <div className="mobile-booking-footer">
        <div className="mobile-footer-info">
          <div className="footer-total">{currency}{totalAmount}</div>
          <div className="footer-sub">{totalDurationMinutes} mins • {selectedServices.length} {selectedServices.length === 1 ? 'service' : 'services'}</div>
        </div>
        <button
          className="mobile-next-btn"
          disabled={!(selectedDate && selectedTime && selectedServices.length) || (selectedPincode.length === 6 && !isPincodeServiceable)}
          onClick={() =>
            navigate("/payment", {
              state: {
                services: selectedServices,
                date: selectedDate,
                time: selectedTime,
                month,
                year,
                total: totalAmount,
                duration: totalDurationMinutes,
                pincode: selectedPincode,
                hub: selectedHubName,
                address: selectedAddress,
              },
            })
          }
        >
          Next
        </button>
      </div>

      {/* ================= ADD-ONS MODAL ================= */}
      {showAddService && (
        <div className="modal-overlay">
          <div className="modal-container">
            <div className="modal-header">
              <h3 className="modal-heading">Add Ons</h3>
              <button
                className="modal-close-inline"
                onClick={() => setShowAddService(false)}
              />
            </div>

            <div className="modal-scroll-content">
              <div className="addon-list-wrapper">
                {addOns.map((svc) => {
                  const isSelected = selectedServices.find((s) => s.id === svc.id);
                  const discountPct = svc.discount_percent || (
                    svc.original_price && svc.price
                      ? Math.round((1 - parseFloat(String(svc.price).replace(/[^\d.]/g, "")) / parseFloat(String(svc.original_price).replace(/[^\d.]/g, ""))) * 100)
                      : 0
                  );
                  return (
                    <div
                      key={svc.id}
                      className={`addon-list-item ${isSelected ? "selected-addon-card" : ""}`}
                      onClick={(e) => {
                        // Prevent detail modal if user clicked on quantity controls or add button
                        if (e.target.closest('.addon-list-actions') || e.target.closest('.view-addon-btn')) return;
                        setSelectedAddOn(svc);
                        setShowAddOnDetail(true);
                      }}
                      style={{ cursor: 'pointer' }}
                    >
                      <div className="addon-list-content">
                        <div className="summary-item-header">
                          <span className="service-name">{svc.title}</span>
                          <div className="addon-badges-group">
                            <span className="service-time">
                              {formatDuration(svc.duration)}
                            </span>
                            {discountPct > 0 && (
                              <span className="addon-discount-badge">{discountPct}% OFF</span>
                            )}
                          </div>
                        </div>

                        <div className="summary-item-footer">
                          <div className="summary-price">
                            {svc.original_price && (
                              <span className="mrp">
                                {getCurrency(svc.original_price)}{formatPrice(svc.original_price)}
                              </span>
                            )}
                            <span className="offer-price">
                              {getCurrency(svc.price)}{formatPrice(svc.price)}
                            </span>
                          </div>

                          <div className="addon-list-actions">
                            <button
                              className="view-addon-btn"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedAddOn(svc);
                                setShowAddOnDetail(true);
                              }}
                            >
                              View
                            </button>

                            {isSelected ? (
                              <div className="quantity-control-boxed" onClick={(e) => e.stopPropagation()}>
                                <button
                                  className="qty-btn-minus"
                                  onClick={() => removeService(svc.id)}
                                >
                                  -
                                </button>
                                <span className="qty-count">
                                  {isSelected.quantity}
                                </span>
                                <button
                                  className="qty-btn-plus"
                                  onClick={() => addService(svc)}
                                >
                                  +
                                </button>
                              </div>
                            ) : (
                              <button
                                className="add-service-btn-small"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  addService(svc);
                                }}
                              >
                                + Add
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="modal-footer">
              <button
                className="modal-continue-btn"
                onClick={() => setShowAddService(false)}
              >
                Continue
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= ADD-ON DETAIL MODAL ================= */}
      {showAddOnDetail && selectedAddOn && (
        <div className="modal-overlay">
          <div className="modal-container addon-detail-modal">
            <button
              className="modal-close"
              onClick={() => setShowAddOnDetail(false)}
            >
              <FiX size={18} />
            </button>

            <div className="modal-scroll-content">
              <div className="addon-detail-hero">
                <img src={selectedAddOn.image} alt={selectedAddOn.title} />
              </div>

              <div className="addon-detail-body">
                <h2 className="addon-detail-title">{selectedAddOn.title}</h2>
                <p className="addon-detail-meta">
                  {selectedAddOn.duration} mins • {selectedAddOn.service_type || "ADDITIONAL SERVICES"}
                </p>

                <div className="addon-detail-price-row">
                  {selectedAddOn.original_price && (
                    <span className="mrp">{getCurrency(selectedAddOn.original_price)}{formatPrice(selectedAddOn.original_price)}</span>
                  )}
                  <span className="offer-price">{getCurrency(selectedAddOn.price)}{formatPrice(selectedAddOn.price)}</span>
                  {Math.round((1 - parseFloat(String(selectedAddOn.price).replace(/[^\d.]/g, "")) / parseFloat(String(selectedAddOn.original_price).replace(/[^\d.]/g, ""))) * 100) > 0 && (
                    <span className="addon-discount-badge">{Math.round((1 - parseFloat(String(selectedAddOn.price).replace(/[^\d.]/g, "")) / parseFloat(String(selectedAddOn.original_price).replace(/[^\d.]/g, ""))) * 100)}% OFF</span>
                  )}
                </div>

                {selectedServices.find((s) => s.id === selectedAddOn.id) ? (
                  <div className="addon-detail-quantity">
                    <button className="qty-btn" onClick={() => removeService(selectedAddOn.id)}>-</button>
                    <span className="qty-count">
                      {selectedServices.find((s) => s.id === selectedAddOn.id).quantity}
                    </span>
                    <button
                      className="qty-btn"
                      onClick={() => addService(selectedAddOn)}
                    >
                      +
                    </button>
                  </div>
                ) : (
                  <button
                    className="addon-add-btn"
                    onClick={() => addService(selectedAddOn)}
                  >
                    + Add to Booking
                  </button>
                )}

                <div className="addon-detail-info">
                  <h3>Description</h3>
                  <p>{selectedAddOn.description || `Neatify ${selectedAddOn.title} ensures a clean and fresh space.`}</p>

                  {selectedAddOn.work_includes && (
                    <>
                      <h3 className="work-includes-heading">Work Includes</h3>
                      <ul className="work-includes-list">
                        {(typeof selectedAddOn.work_includes === "string"
                          ? selectedAddOn.work_includes.split("\n")
                          : Array.isArray(selectedAddOn.work_includes)
                            ? selectedAddOn.work_includes
                            : []
                        ).map((item, i) => (
                          <li key={i}>{item.trim()}</li>
                        ))}
                      </ul>
                    </>
                  )}

                  {selectedAddOn.work_not_included && (
                    <>
                      <h3 className="work-not-included-heading">Work Not Included</h3>
                      <ul className="work-not-included-list">
                        {(typeof selectedAddOn.work_not_included === "string"
                          ? selectedAddOn.work_not_included.split("\n")
                          : Array.isArray(selectedAddOn.work_not_included)
                            ? selectedAddOn.work_not_included
                            : []
                        ).map((item, i) => (
                          <li key={i}>{item.trim()}</li>
                        ))}
                      </ul>
                    </>
                  )}
                  <div style={{ paddingBottom: '30px' }} />
                </div>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* ================= MAP PICKER MODAL ================= */}
      {showMapPickerModal && (
        <MapPicker
          initialLat={latitude || 17.4399}
          initialLng={longitude || 78.4983}
          onConfirm={handleMapConfirm}
          onClose={() => setShowMapPickerModal(false)}
        />
      )}

    </>
  );
}

/* ===== MAP PICKER COMPONENT ===== */
function MapPicker({ initialLat, initialLng, onConfirm, onClose }) {
  const toast = useToast();
  const mapRef = useRef(null);
  const leafletMapRef = useRef(null);
  const markerRef = useRef(null);
  const accuracyCircleRef = useRef(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [picking, setPicking] = useState(false);
  const [pickedData, setPickedData] = useState(null);
  const [mapMode, setMapMode] = useState("light");
  const tileLayerRef = useRef(null);
  const lastRequestId = useRef(0);

  const reverseGeocode = useCallback(async (lat, lng, accuracy = null, customAddress = null) => {
    const requestId = ++lastRequestId.current;
    setPicking(true);
    setPickedData(null);

    let data = null;

    // 1. Try Nominatim with a 3-second timeout
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);

      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&addressdetails=1&accept-language=en&zoom=18`,
        { signal: controller.signal }
      );
      clearTimeout(timeoutId);

      if (res.ok) {
        data = await res.json();
      }
    } catch (e) {
      console.warn("Nominatim reverse geocode timed out or failed, trying Photon fallback:", e);
    }

    // 2. Fallback to Photon Reverse Geocoding with a 3-second timeout
    if (!data || !data.address) {
      try {
        const pController = new AbortController();
        const pTimeoutId = setTimeout(() => pController.abort(), 3000);

        const pRes = await fetch(
          `https://photon.komoot.io/reverse?lat=${lat}&lon=${lng}&lang=en`,
          { signal: pController.signal }
        );
        clearTimeout(pTimeoutId);

        if (pRes.ok) {
          const pJson = await pRes.json();
          if (pJson?.features && pJson.features.length > 0) {
            const props = pJson.features[0].properties || {};
            data = {
              address: {
                road: props.street || props.name || "",
                suburb: props.district || props.suburb || props.locality || "",
                city: props.city || props.county || props.state || "",
                postcode: props.postcode || "",
                building: props.name || ""
              },
              display_name: [props.name, props.street, props.district, props.city, props.state, props.postcode].filter(Boolean).join(", ")
            };
          }
        }
      } catch (e) {
        console.warn("Photon reverse geocode fallback failed:", e);
      }
    }

    if (requestId !== lastRequestId.current) return;

    if (data && data.address) {
      const addr = data.address;
      const city = addr.city || addr.town || addr.village || addr.county || "";
      const zip = addr.postcode || "";
      const parts = [];
      if (addr.amenity) parts.push(addr.amenity);
      if (addr.office) parts.push(addr.office);
      if (addr.shop) parts.push(addr.shop);
      if (addr.tourism) parts.push(addr.tourism);
      if (addr.leisure) parts.push(addr.leisure);
      if (addr.building) parts.push(addr.building);
      if (addr.house_number) parts.push(addr.house_number);
      if (addr.road) parts.push(addr.road);
      if (addr.neighbourhood) parts.push(addr.neighbourhood);
      if (addr.residential) parts.push(addr.residential);
      if (addr.suburb) parts.push(addr.suburb);
      if (addr.city_district) parts.push(addr.city_district);
      if (city) parts.push(city);
      const fetchedAddress = formatTotalAddress(data, parts);

      let correctedZip = zip;
      const isPragathiNagar = fetchedAddress.toLowerCase().includes("pragathi nagar") ||
        (data.display_name && data.display_name.toLowerCase().includes("pragathi nagar"));

      if (isPragathiNagar && (zip === "501002" || !zip)) {
        correctedZip = "500090";
      }

      let finalAddress = fetchedAddress;
      if ((correctedZip === "500090" || correctedZip === "501002") && !finalAddress.toLowerCase().includes("hyderabad")) {
        finalAddress += ", Hyderabad";
      }

      const displayAddress = customAddress || ((correctedZip && !finalAddress.includes(correctedZip))
        ? `${finalAddress} - ${correctedZip}`
        : finalAddress);

      const buildingName = addr.amenity || addr.office || addr.shop || addr.tourism || addr.leisure || addr.building;

      setPickedData({
        lat,
        lng,
        address: displayAddress,
        zip: correctedZip,
        city,
        accuracy,
        buildingName
      });
    } else {
      // Instant fallback if geocoding APIs timed out
      const fallbackAddr = customAddress || `Pinned Location (${lat.toFixed(4)}, ${lng.toFixed(4)})`;
      setPickedData({
        lat,
        lng,
        address: fallbackAddr,
        zip: "",
        city: "",
        accuracy,
        buildingName: ""
      });
    }
    setPicking(false);
  }, []);

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    let searchStatus = "";

    const performFetch = async (query, useViewbox = false) => {
      try {
        let url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1&accept-language=en`;
        if (useViewbox && leafletMapRef.current) {
          const bounds = leafletMapRef.current.getBounds();
          const viewbox = `${bounds.getWest()},${bounds.getNorth()},${bounds.getEast()},${bounds.getSouth()}`;
          url += `&viewbox=${viewbox}&bounded=0`;
        }
        const res = await fetch(url);
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data) && data.length > 0) return data;
        }
      } catch (e) {
        console.warn("Nominatim search failed, trying Photon fallback...", e);
      }

      // Fallback geocoding service (Photon by Komoot - higher rate limits)
      try {
        const photonUrl = `https://photon.komoot.io/api/?q=${encodeURIComponent(query)}&limit=1&lang=en`;
        const pRes = await fetch(photonUrl);
        if (pRes.ok) {
          const pData = await pRes.json();
          if (pData?.features && pData.features.length > 0) {
            const feat = pData.features[0];
            return [{
              lat: feat.geometry.coordinates[1],
              lon: feat.geometry.coordinates[0],
              display_name: feat.properties.name || query
            }];
          }
        }
      } catch (e) {
        console.error("Photon fallback error:", e);
      }

      return [];
    };

    const cleanQueryParts = (query) => {
      return query
        .replace(/,\s*Tel(?:angana)?\s*$/i, ", Telangana")
        .replace(/,\s*Tel\s*$/i, "")
        .split(",")
        .map(p => p.trim())
        .filter(Boolean);
    };

    try {
      let queryParts = cleanQueryParts(searchQuery);
      let results = [];
      let usedQuery = searchQuery;

      while (queryParts.length > 0) {
        const currentQuery = queryParts.join(", ");
        results = await performFetch(currentQuery, true);
        if (results && results.length > 0) {
          usedQuery = currentQuery;
          if (usedQuery !== searchQuery) {
            searchStatus = `Showing general area for "${usedQuery}". Please adjust the pin to your exact spot.`;
          }
          break;
        }

        results = await performFetch(currentQuery, false);
        if (results && results.length > 0) {
          usedQuery = currentQuery;
          if (usedQuery !== searchQuery) {
            searchStatus = `Showing general area for "${usedQuery}". Please adjust the pin.`;
          }
          break;
        }

        if (queryParts.length === 1) {
          const stripped = currentQuery
            .replace(/plot|flat|house|residency|apartment|building|villa|shop|no|dr\.|opposite|beside/gi, " ")
            .replace(/\s+/g, " ")
            .trim();
          if (stripped !== currentQuery) {
            results = await performFetch(stripped, true) || await performFetch(stripped, false);
            if (results && results.length > 0) {
              usedQuery = stripped;
              break;
            }
          }
        }
        queryParts.shift();
      }

      if (results && results.length > 0) {
        const { lat, lon } = results[0];
        const newLat = parseFloat(lat);
        const newLng = parseFloat(lon);

        if (searchStatus) {
          toast.info(searchStatus, { duration: 6000 });
        }

        setPickedData({
          lat: newLat,
          lng: newLng,
          address: searchQuery,
          zip: "",
          city: "",
          accuracy: null
        });

        if (leafletMapRef.current && markerRef.current) {
          const el = markerRef.current.getElement();
          if (el) {
            el.classList.remove('marker-bounce');
            void el.offsetWidth;
            el.classList.add('marker-bounce');
          }

          leafletMapRef.current.flyTo([newLat, newLng], 18, {
            duration: 1.5,
            easeLinearity: 0.25
          });
          markerRef.current.setLatLng([newLat, newLng]);
          reverseGeocode(newLat, newLng, null, searchQuery);
        }
      } else {
        alert("We couldn't find this spot. Try searching for a nearby landmark, colony name, or area name.");
      }
    } catch (error) {
      console.error("Search failed:", error);
      alert("Search service is temporarily unavailable. Please try manual pinning.");
    } finally {
      setIsSearching(false);
    }
  };

  const [isLeafletLoaded, setIsLeafletLoaded] = useState(!!window.L);
  const initRetryCount = useRef(0);

  useEffect(() => {
    if (!window.L) {
      const script = document.createElement('script');
      script.src = "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.js";
      script.async = true;
      script.onload = () => {
        setIsLeafletLoaded(true);
      };
      script.onerror = () => { };
      document.head.appendChild(script);

      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.css";
      document.head.appendChild(link);
    } else {
      setIsLeafletLoaded(true);
    }
  }, []);

  const locateMe = useCallback(() => {
    if (!navigator.geolocation) return;
    setPicking(true);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude: lat, longitude: lng, accuracy } = pos.coords;
        if (leafletMapRef.current && markerRef.current) {
          leafletMapRef.current.setView([lat, lng], 18);
          markerRef.current.setLatLng([lat, lng]);

          if (accuracyCircleRef.current) {
            leafletMapRef.current.removeLayer(accuracyCircleRef.current);
          }
          accuracyCircleRef.current = window.L.circle([lat, lng], {
            radius: accuracy,
            color: "#3b82f6",
            fillColor: "#3b82f6",
            fillOpacity: 0.15,
            weight: 2,
            dashArray: "5, 5"
          }).addTo(leafletMapRef.current);

          reverseGeocode(lat, lng, accuracy);
        }
        setPicking(false);
      },
      () => {
        setPicking(false);
        alert("Could not fetch device location. Please try manually pinning.");
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  }, [reverseGeocode]);

  useEffect(() => {
    const initTimer = setInterval(() => {
      if (leafletMapRef.current) {
        clearInterval(initTimer);
        return;
      }

      const container = mapRef.current;
      if (!window.L || !container || container.offsetHeight < 50) {
        initRetryCount.current++;
        if (initRetryCount.current > 20) clearInterval(initTimer);
        return;
      }

      try {
        const map = window.L.map(container, {
          zoomControl: true,
          attributionControl: true,
          preferCanvas: true
        }).setView([initialLat, initialLng], 18);

        leafletMapRef.current = map;
        clearInterval(initTimer);

        const lightTiles = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
        const lightAttribution = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

        tileLayerRef.current = window.L.tileLayer(lightTiles, {
          attribution: lightAttribution,
          maxZoom: 19
        }).addTo(map);

        const icon = window.L.divIcon({
          className: "custom-marker",
          html: `<div class="marker-pin"></div><div class="marker-pulse"></div>`,
          iconSize: [30, 42],
          iconAnchor: [15, 42]
        });

        const marker = window.L.marker([initialLat, initialLng], { icon, draggable: true }).addTo(map);
        markerRef.current = marker;

        const forceUpdate = () => {
          if (leafletMapRef.current) leafletMapRef.current.invalidateSize();
        };

        forceUpdate();
        setTimeout(forceUpdate, 100);
        setTimeout(forceUpdate, 500);
        setTimeout(forceUpdate, 1500);

        reverseGeocode(initialLat, initialLng);

        const isDefault = (Math.abs(initialLat - 17.4399) < 0.001 && Math.abs(initialLng - 78.4983) < 0.001);
        if (isDefault) locateMe();

        map.on("click", (e) => {
          marker.setLatLng(e.latlng);
          reverseGeocode(e.latlng.lat, e.latlng.lng);
        });

        marker.on("dragend", () => {
          const { lat, lng } = marker.getLatLng();
          reverseGeocode(lat, lng);
        });

      } catch (err) {
        clearInterval(initTimer);
      }
    }, 500);

    return () => {
      clearInterval(initTimer);
      if (leafletMapRef.current) {
        leafletMapRef.current.remove();
        leafletMapRef.current = null;
      }
    };
  }, [isLeafletLoaded, initialLat, initialLng, locateMe, reverseGeocode]);

  useEffect(() => {
    if (!leafletMapRef.current || !tileLayerRef.current) return;

    const layer = tileLayerRef.current;
    if (mapMode === "satellite") {
      layer.setUrl("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}");
      layer.options.attribution = 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EBP, and the GIS User Community';
    } else {
      layer.setUrl("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png");
      layer.options.attribution = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';
    }
  }, [mapMode]);

  useEffect(() => {
    if (leafletMapRef.current) {
      leafletMapRef.current.invalidateSize();
    }
  }, [pickedData, picking, isSearching]);

  return (
    <div className="map-picker-overlay">
      <div className="map-picker-modal">
        <div className="map-picker-header">
          <div className="map-picker-header-content">
            <span className="map-picker-badge">📍</span>
            <div className="map-picker-texts">
              <span className="map-picker-title">Pin Your Location</span>
              <span className="map-picker-subtitle">Search for your area and drag the pin to your gate</span>
            </div>
          </div>
          <button className="map-picker-close-circle" onClick={onClose} title="Close">✕</button>
        </div>

        <div className="map-search-container-premium">
          <form className="map-search-bar-modern" onSubmit={handleSearch}>
            <div className="search-input-wrapper-glass">
              <FiSearch size={18} className="search-icon-svg" />
              <input
                type="text"
                placeholder="Search building, apartment or area..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              {searchQuery && (
                <button type="button" className="search-clear-btn" onClick={() => setSearchQuery("")}>✕</button>
              )}
            </div>
            <button className="search-submit-btn-premium" type="submit" disabled={isSearching || !searchQuery.trim()}>
              {isSearching ? <div className="spinner-small"></div> : "Search"}
            </button>
          </form>
        </div>

        <div className="map-canvas-container-premium">
          <div
            ref={mapRef}
            className="map-picker-canvas-modern"
            style={{ height: '100%', width: '100%', display: 'block' }}
          />

          <div className="map-controls-floating">
            <button
              className={`map-layer-toggle ${mapMode === 'satellite' ? 'active' : ''}`}
              onClick={() => setMapMode(mapMode === 'light' ? 'satellite' : 'light')}
              title={mapMode === 'light' ? "Satellite View" : "Map View"}
            >
              {mapMode === 'light' ? (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>
              ) : (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>
              )}
            </button>
            <button className="map-locate-btn-premium" onClick={locateMe} title="Recenter to Me">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M12 2v2m0 16v2M2 12h2m16 0h2"></path></svg>
            </button>
          </div>

          <button
            type="button"
            className="map-refresh-floating-btn"
            onClick={() => {
              if (leafletMapRef.current) {
                leafletMapRef.current.invalidateSize();
                toast.success("Map refreshed!");
              } else {
                window.location.reload();
              }
            }}
          >
            <span>↻</span>
          </button>
        </div>

        <div style={{ flexShrink: 0 }}>
          {pickedData ? (
            <div className="map-picker-address-card">
              <div className="address-card-pin">📍</div>
              <div className="address-card-info">
                <p className="address-card-main">{pickedData.address || "Fetching address..."}</p>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap' }}>
                  {pickedData.zip && <span className="address-card-sub">Pincode: {pickedData.zip}</span>}
                  {pickedData.accuracy && (
                    <span className={`address-card-sub accuracy-${pickedData.accuracy < 20 ? 'high' : pickedData.accuracy < 100 ? 'medium' : 'low'}`}>
                      Accuracy: {Math.round(pickedData.accuracy)}m
                    </span>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="map-picker-address-card placeholder">
              <div className="spinner-small"></div>
              <p>Pinning location...</p>
            </div>
          )}

          {pickedData?.buildingName && (
            <div className="map-snap-suggestion">
              <span className="snap-icon">✨</span>
              <p>Found <strong>{pickedData.buildingName}</strong>. Want to snap the pin to its center?</p>
              <button
                className="snap-btn"
                onClick={async () => {
                  try {
                    const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(pickedData.buildingName + ", " + pickedData.city)}&limit=1&accept-language=en`);
                    const data = await res.json();
                    if (data && data.length > 0) {
                      const nLat = parseFloat(data[0].lat);
                      const nLng = parseFloat(data[0].lon);
                      if (leafletMapRef.current && markerRef.current) {
                        leafletMapRef.current.flyTo([nLat, nLng], 18);
                        markerRef.current.setLatLng([nLat, nLng]);
                        reverseGeocode(nLat, nLng, pickedData.accuracy);
                        toast.success(`Snapped to ${pickedData.buildingName}!`);
                      }
                    }
                  } catch (e) {
                    toast.error("Could not snap to building.");
                  }
                }}
              >
                Snap Pin
              </button>
            </div>
          )}

          <div className="map-accuracy-premium-box">
            <span className="accuracy-label">💡 PRO TIP</span>
            <p>On desktop, drag the <strong>red pulse pin</strong> exactly to your house gate for 100% accuracy.</p>
          </div>

          <div className="map-picker-footer">
            <button className="map-picker-cancel" onClick={onClose}>Cancel</button>
            <button
              className="map-picker-confirm"
              disabled={!pickedData || picking}
              onClick={() => onConfirm(pickedData)}
            >
              {picking || isSearching ? "Wait..." : "Confirm Location"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}