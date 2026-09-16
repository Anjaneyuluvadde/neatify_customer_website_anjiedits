import { useEffect, useMemo, useState, useCallback, useRef } from "react";

import { useLocation, useNavigate, useParams } from "react-router-dom";
import { FiShare2, FiArrowLeft, FiX, FiCheckCircle, FiXCircle, FiInfo, FiChevronLeft, FiChevronRight } from "react-icons/fi";

import { Helmet } from "react-helmet-async"; // ✅ Import Helmet-Async
import { supabase } from "../components/supabaseClient";
import Header from "../components/Header";
import { useToast } from "../components/Toast/ToastContext";
import { formatDuration } from "../utils/durationUtils";
import { calculateServicePrice } from "../utils/priceUtils";
import "./ServiceDetail.css";

/* ==================== SCROLL REVEAL COMPONENT ==================== */

const ScrollReveal = ({ children, direction = "down" }) => {
  const ref = useRef(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const currentRef = ref.current;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.unobserve(entry.target);
        }
      },
      { threshold: 0.1, rootMargin: "-5% 0px -5% 0px" }
    );

    if (currentRef) observer.observe(currentRef);
    return () => {
      if (currentRef) observer.unobserve(currentRef);
    };
  }, []);

  return (
    <div
      ref={ref}
      className={`scroll-reveal ${isVisible ? "revealed" : ""} ${(!isVisible && direction === "up") ? "no-blur-transition" : ""}`}
    >
      {children}
    </div>
  );
};

/* ==================== SKELETON COMPONENT ==================== */
const ServiceDetailSkeleton = () => (
  <div className="skeleton-page">
    <div className="skeleton-hero shimmer" />
    <div className="skeleton-content">
      <div className="skeleton-line title shimmer" />
      <div className="skeleton-line price shimmer" />
      <div className="skeleton-actions">
        <div className="skeleton-btn shimmer" />
        <div className="skeleton-btn circle shimmer" />
      </div>
      <div className="skeleton-line text shimmer" />
      <div className="skeleton-line text shimmer" />
      <div className="skeleton-line text shimmer" />
    </div>
  </div>
);

/* ==================== HELPER: DYNAMIC FLOW STEPS ==================== */
const getServiceFlowSteps = (title, type) => {
  const sTitle = (title || "").toLowerCase();
  const sType = (type || "").toLowerCase();

  if (sTitle.includes("fridge") || sTitle.includes("refrigerator")) {
    return [
      { title: "Emptying & Preparation", desc: "Carefully removing all items, shelves, and trays from the fridge." },
      { title: "Interior Deep Cleaning", desc: "Thorough scrubbing of inner walls to remove spills, stains, and grime." },
      { title: "Shelves & Trays Washing", desc: "Washing and sanitizing all removable compartments and shelves." },
      { title: "Sanitization & Odor Removal", desc: "Complete disinfection to eliminate bacteria and foul odors." },
      { title: "Exterior & Seal Cleaning", desc: "Wiping down the outer body, handles, and rubber door seals." }
    ];
  }

  if (sTitle.includes("utensil")) {
    return [
      { title: "Careful Removal", desc: "Carefully taking out all utensils and items from cabinets and drawers." },
      { title: "Safe Storage", desc: "Temporarily organizing the utensils in a safe designated area." },
      { title: "Assisting Deep Clean", desc: "Allowing the cleaning team unrestricted access to empty cabinets." },
      { title: "Surface Drying", desc: "Ensuring all cabinets and drawers are completely dry before restocking." },
      { title: "Systematic Placing Back", desc: "Neatly arranging all utensils back to their original places." }
    ];
  }

  if (sTitle.includes("microwave") || sTitle.includes("oven")) {
    return [
      { title: "Unplugging & Inspection", desc: "Safely disconnecting the appliance and inspecting for stains." },
      { title: "Interior Degreasing", desc: "Applying specialized degreasers to loosen tough, baked-on grime." },
      { title: "Tray & Rack Washing", desc: "Removing and deeply washing the turntable, trays, and racks." },
      { title: "Scrubbing & Wiping", desc: "Thoroughly scrubbing the inner cabin and wiping away all residue." },
      { title: "Exterior Polishing", desc: "Cleaning the outer body, glass door, and control panel for a shiny finish." }
    ];
  }

  if (sTitle.includes("chimney")) {
    return [
      { title: "Dismantling Filters", desc: "Carefully removing the baffle or mesh filters from the chimney." },
      { title: "Filter Degreasing", desc: "Soaking and scrubbing filters in strong degreasing solutions." },
      { title: "Interior Scrubbing", desc: "Cleaning the accessible inner parts of the chimney to remove sticky oil." },
      { title: "Exterior Wiping", desc: "Wiping down the outer hood and controls to remove greasy residue." },
      { title: "Reassembly & Testing", desc: "Placing the dry filters back and ensuring the chimney functions properly." }
    ];
  }

  if (sTitle.includes("wardrobe") || sTitle.includes("cupboard")) {
    return [
      { title: "Emptying Contents", desc: "Safely removing all clothes and items from the wardrobe." },
      { title: "Dry Dusting", desc: "Removing loose dust and cobwebs from all shelves and corners." },
      { title: "Interior Wiping", desc: "Wiping down the inside panels, shelves, and drawers with a damp cloth." },
      { title: "Exterior Cleaning", desc: "Cleaning the wardrobe doors, handles, and outer surfaces." },
      { title: "Organizing & Placing Back", desc: "Allowing the interior to dry and neatly placing the items back." }
    ];
  }

  if (sTitle.includes("bathroom") || sType.includes("bathroom")) {
    return [
      { title: "Toilet Deep Cleaning", desc: "Thorough cleaning and sanitization of toilet bowls and seats." },
      { title: "Basin & Countertop Cleaning", desc: "Intensive cleaning of basins, fittings, and countertops for a sparkling finish." },
      { title: "Shower & Tap Cleaning", desc: "Deep cleaning of shower areas, taps, and mixers to remove limescale and grime." },
      { title: "Tile & Grout Cleaning", desc: "Deep cleaning of tiles, grout lines, and corners for a hygienic bathroom." },
      { title: "Floor Cleaning & Mopping", desc: "Deep scrubbing of floors followed by disinfected mopping for a spotless shine." }
    ];
  }
  if (sTitle.includes("kitchen") || sType.includes("kitchen")) {
    return [
      { title: "Cabinet & Drawer Cleaning", desc: "External and internal cleaning of all kitchen cabinets and drawers." },
      { title: "Appliance Exterior Cleaning", desc: "Degreasing and wiping down of fridge, microwave, and oven exteriors." },
      { title: "Countertop & Sink Scrubbing", desc: "Thorough scrubbing of countertops, sink, and surrounding tiles." },
      { title: "Chimney & Exhaust Degreasing", desc: "Removal of sticky oil and grease from chimneys and exhaust fans." },
      { title: "Floor Scrubbing", desc: "Deep cleaning of the kitchen floor to remove tough stains and grime." }
    ];
  }
  if (sTitle.includes("balcony") || sType.includes("balcony")) {
    return [
      { title: "Dry Dusting & Cobweb Removal", desc: "Clearing out all loose dust, dirt, and cobwebs from the balcony." },
      { title: "Grill & Railing Wiping", desc: "Thorough wiping of metal or glass railings and grills." },
      { title: "Floor Scrubbing & Washing", desc: "Intensive washing and scrubbing of balcony tiles to remove stains." },
      { title: "Glass & Window Cleaning", desc: "Streak-free cleaning of balcony doors and glass panes." },
      { title: "Final Water Wash & Drying", desc: "Rinsing the area and wiping it down for a clean finish." }
    ];
  }
  if (sTitle.includes("sofa") || sType.includes("sofa") || sTitle.includes("carpet") || sTitle.includes("mattress")) {
    return [
      { title: "Dry Vacuuming", desc: "High-power vacuuming to extract deep-seated dust and dirt particles." },
      { title: "Spot Treatment", desc: "Application of specialized stain removers on visible spots and spills." },
      { title: "Shampooing & Scrubbing", desc: "Gentle scrubbing with fabric-safe shampoo to lift embedded grime." },
      { title: "Wet Vacuuming & Extraction", desc: "Extracting dirty water and shampoo residue for a deep clean." },
      { title: "Drying & Final Grooming", desc: "Leaving the fabric slightly damp to air dry naturally." }
    ];
  }
  if (sTitle.includes("deep cleaning") || sType.includes("deep cleaning") || sTitle.includes("home")) {
    return [
      { title: "Dry Dusting & Vacuuming", desc: "Comprehensive dusting of ceilings, walls, and all furniture surfaces." },
      { title: "Intensive Kitchen Cleaning", desc: "Deep degreasing and scrubbing of the entire kitchen area." },
      { title: "Bathroom Deep Cleaning", desc: "Thorough descaling, scrubbing, and sanitizing of all bathrooms." },
      { title: "Window & Balcony Cleaning", desc: "Washing of windows, tracks, and balcony floors." },
      { title: "Floor Scrubbing & Mopping", desc: "Machine or manual deep scrubbing of all floor areas for a pristine look." }
    ];
  }
  
  // Default Generic Flow
  return [
    { title: "Site Inspection & Preparation", desc: "Initial assessment to identify specific cleaning requirements." },
    { title: "Application of Cleaning Agents", desc: "Applying effective cleaning solutions to loosen dirt and grime." },
    { title: "Deep Cleaning & Scrubbing", desc: "Intensive scrubbing and stain removal for a spotless finish." },
    { title: "Sanitization & Disinfection", desc: "Thorough sanitization to eliminate germs and bacteria." },
    { title: "Quality Check & Handover", desc: "Final inspection to ensure everything meets our high standards." }
  ];
};

export default function ServiceDetail({ user }) {






  const { state } = useLocation();
  const { id } = useParams();
  const navigate = useNavigate();

  const [fetchedService, setFetchedService] = useState(null);
  const [allServices, setAllServices] = useState(state?.allServices || []);
  const [isFetching, setIsFetching] = useState(!state?.service);
  const [error, setError] = useState(null);

  const service = state?.service || fetchedService;

  const [showSummary, setShowSummary] = useState(false);
  const [showAddService, setShowAddService] = useState(false);
  const [showAddOnDetail, setShowAddOnDetail] = useState(false);
  const [selectedAddOn, setSelectedAddOn] = useState(null);
  const [addOns, setAddOns] = useState([]);
  const [selectedServices, setSelectedServices] = useState([]);
  const [activeLightboxImage, setActiveLightboxImage] = useState(null);
  const [scrollDirection, setScrollDirection] = useState("down");
  const lastScrollY = useRef(0);
  const addonModalRef = useRef(null);
  const [showAddonScrollDown, setShowAddonScrollDown] = useState(false);
  const toast = useToast();

  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      if (currentScrollY > lastScrollY.current) {
        setScrollDirection("down");
      } else if (currentScrollY < lastScrollY.current) {
        setScrollDirection("up");
      }
      lastScrollY.current = currentScrollY;
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // ✅ Gallery Navigation Logic (Non-Cyclic)
  const handleNextImage = useCallback((e) => {
    if (e) e.stopPropagation();
    if (!service?.gallery_images) return;
    const currentIndex = service.gallery_images.indexOf(activeLightboxImage);
    if (currentIndex < service.gallery_images.length - 1) {
      setActiveLightboxImage(service.gallery_images[currentIndex + 1]);
    }
  }, [activeLightboxImage, service?.gallery_images]);

  const handlePrevImage = useCallback((e) => {
    if (e) e.stopPropagation();
    if (!service?.gallery_images) return;
    const currentIndex = service.gallery_images.indexOf(activeLightboxImage);
    if (currentIndex > 0) {
      setActiveLightboxImage(service.gallery_images[currentIndex - 1]);
    }
  }, [activeLightboxImage, service?.gallery_images]);

  useEffect(() => {
    if (!activeLightboxImage) return;
    const handleKeyDown = (e) => {
      if (e.key === "ArrowRight") handleNextImage();
      if (e.key === "ArrowLeft") handlePrevImage();
      if (e.key === "Escape") setActiveLightboxImage(null);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeLightboxImage, handleNextImage, handlePrevImage]);

  // ✅ Add-ons Modal Scroll Detection
  const checkScrollToBottom = useCallback(() => {
    if (!addonModalRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = addonModalRef.current;
    // Show button if not at bottom (with 20px threshold)
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 20;
    setShowAddonScrollDown(!isAtBottom && scrollHeight > clientHeight);
  }, []);

  const scrollAddonToBottom = () => {
    if (addonModalRef.current) {
      addonModalRef.current.scrollTo({
        top: addonModalRef.current.scrollHeight,
        behavior: "smooth",
      });
    }
  };

  useEffect(() => {
    if (showAddService) {
      // Small delay to ensure content is rendered before checking
      const timer = setTimeout(checkScrollToBottom, 100);
      return () => clearTimeout(timer);
    } else {
      setShowAddonScrollDown(false);
    }
  }, [showAddService, addOns, checkScrollToBottom]);

  // ✅ Prevent body scroll when any modal is open
  useEffect(() => {
    const isAnyModalOpen = showSummary || showAddService || showAddOnDetail;
    if (isAnyModalOpen) {
      document.body.classList.add("no-scroll");
    } else {
      document.body.classList.remove("no-scroll");
    }
    return () => document.body.classList.remove("no-scroll");
  }, [showSummary, showAddService, showAddOnDetail]);

  const handleShare = async () => {
    try {
      if (navigator.share) {
        // Omitting 'text' sometimes forces apps to show the link-preview card instead of plain text
        await navigator.share({
          title: service?.title,
          url: window.location.href,
        });
      } else {
        // Desktop fallback: Keep the text for copy-paste convenience
        const shareText = `Check out ${service?.title} on Neatify!\n${window.location.href}`;
        await navigator.clipboard.writeText(shareText);
        toast.success("Link copied to clipboard!");
      }
    } catch (err) {
      console.error("Error sharing:", err);
    }
  };

  const getAbsoluteImageUrl = (url) => {
    if (!url) return "";
    if (url.startsWith("http")) return url;
    return `${window.location.origin}${url.startsWith("/") ? "" : "/"}${url}`;
  };

  /* ================= FETCH SERVICE IF MISSING ================= */


  /* ✅ DEEP LINK REDIRECT LOGIC */
  useEffect(() => {
    // Attempt to open in app on page load if it's a direct entry
    if (id && !state?.service) {
      const appUrl = `neatifynation://service/${id}`;

      // Create a hidden iframe to attempt opening the app
      const iframe = document.createElement("iframe");
      iframe.style.display = "none";
      iframe.src = appUrl;
      document.body.appendChild(iframe);

      // Clean up iframe after attempt
      const timer = setTimeout(() => {
        if (document.body.contains(iframe)) {
          document.body.removeChild(iframe);
        }
      }, 2000);

      return () => {
        clearTimeout(timer);
        if (document.body.contains(iframe)) {
          document.body.removeChild(iframe);
        }
      };
    }
  }, [id, state?.service]);

  const fetchServiceById = useCallback(async (serviceId) => {
    try {
      setIsFetching(true);

      // 1. Fetch the service
      let { data, error } = await supabase
        .from("services")
        .select("*")
        .eq("slug", serviceId)
        .maybeSingle();

      if (!data) {
        ({ data, error } = await supabase
          .from("services")
          .select("*")
          .eq("id", serviceId)
          .maybeSingle());
      }

      if (error) throw error;
      if (!data) throw new Error("Service not found");

      // 2. Fetch ALL services (for the Header search to be consistent)
      const { data: allServicesData } = await supabase.from("services").select("*");

      // 3. Fetch active offers
      const { data: offersData } = await supabase
        .from("offers")
        .select("*")
        .eq("is_offer_enabled", true)
        .order("created_at", { ascending: false });

      const claimedOffer = JSON.parse(sessionStorage.getItem("claimedOffer") || "null");

      // 4. Transform main service
      const pricing = calculateServicePrice(data, offersData, claimedOffer);
      const mergedService = {
        ...data,
        price: pricing.price,
        discount_percent: pricing.discount_percent,
        discount_label: pricing.discount_label
      };

      // 5. Transform all services for Header (so search prices are also correct)
      const transformedAll = (allServicesData || []).map(s => {
        const p = calculateServicePrice(s, offersData, claimedOffer);
        return { ...s, price: p.price, discount_percent: p.discount_percent, discount_label: p.discount_label };
      });

      setFetchedService(mergedService);
      // We'll store transformedAll in a new state to pass to Header
      setAllServices(transformedAll);
    } catch (err) {
      console.error("Error fetching service:", err);
      setError(true);
    } finally {
      setIsFetching(false);
    }
  }, []);

  /* ================= FETCH SERVICE IF MISSING ================= */
  useEffect(() => {
    if (!state?.service && id) {
      fetchServiceById(id);
    }
  }, [id, state?.service, fetchServiceById]);



  /* CURRENCY & PRICE FORMATTER */
  const getCurrency = (value) => {
    if (!value) return "₹"; // Fallback
    const match = String(value).match(/^([^\d\s]+)/);
    return match ? match[1] : "₹";
  };

  const formatPrice = (value) => {
    if (value === 0 || value === "0") return "0";
    if (!value) return "";
    return value.toString().replace(/^[^\d\s]+\s*/, "");
  };

  const currency = useMemo(() => getCurrency(service?.price || service?.original_price), [service]);

  /* ================= CLAIMED OFFER LOGIC ================= */
  const claimedOffer = useMemo(() => {
    try {
      const stored = sessionStorage.getItem("claimedOffer");
      if (!stored) return null;
      const parsed = JSON.parse(stored);
      // Only apply if it's the same service or is a general offer (serviceId is null)
      if (parsed.serviceId === service?.id || parsed.serviceId === null) {
        return parsed;
      }
    } catch (e) {
      console.error("Error parsing claimedOffer:", e);
    }
    return null;
  }, [service]);

  // Use the claimed offer price if it exists, otherwise calculate from original_price if a discount exists
  const displayPrice = useMemo(() => {
    return service?.price;
  }, [service]);

  /* ================= FETCH ADD ONS ================= */
  useEffect(() => {
    if (!service) return;

    // Normalizing mappedType to match database strings
    const rawType = (service.service_type || "").toUpperCase();
    let mappedType = rawType.replace(/_/g, " ").trim();
    if (mappedType === "ADDITIONAL") mappedType = "ADDITIONAL SERVICES";
    if (mappedType === "KITCHEN CLEANING") mappedType = "KITCHEN";
    if (mappedType === "FULL HOME DEEP CLEANING") mappedType = "DEEP CLEANING";

    supabase
      .from("add_ons")
      .select(
        "id, title, duration, price, original_price, discount_percent, image, work_includes, description, work_not_included, service_type, max_quantity, is_active"
      )
      .eq("service_type", mappedType)
      .eq("is_active", true)
      .order("sort_order", { ascending: true })
      .then(({ data }) => {
        if (data) setAddOns(data);
      })
      .catch((err) => console.log("Abort or Network error fetching add-ons:", err));
  }, [service]);

  /* ================= INIT MAIN SERVICE ================= */
  useEffect(() => {
    if (service) {
      setSelectedServices([
        {
          ...service,
          quantity: 1,
        },
      ]);
    }
  }, [service]);

  /* ================= ADD ADD-ON ================= */
  const addService = (svc) => {

    const existing = selectedServices.find((s) => s.id === svc.id);
    if (existing) {
      const limit = existing.max_quantity || 100;
      if (existing.quantity >= limit) {
        toast.error(`You can only add up to ${limit} of this service.`);
        return;
      }

      setSelectedServices((prev) =>
        prev.map((s) => (s.id === svc.id ? { ...s, quantity: (s.quantity || 1) + 1 } : s))
      );
      return;
    }

    // New service addition
    const originalPrice = svc.original_price
      ? parseFloat(String(svc.original_price).replace(/[^\d.]/g, ""))
      : null;
    const discountPercent = parseFloat(svc.discount_percent) || 0;
    const calculatedPrice =
      originalPrice && discountPercent > 0
        ? Math.round(originalPrice * (1 - discountPercent / 100))
        : svc.price;

    setSelectedServices((prev) => [
      ...prev,
      {
        ...svc,
        price: calculatedPrice,
        quantity: 1,
      },
    ]);
  };

  /* ✅ REMOVE ADD-ON (OR DECREMENT) */
  const removeService = (id) => {
    setSelectedServices((prev) => {
      const existing = prev.find((s) => s.id === id);
      if (existing && existing.quantity > 1) {
        return prev.map((s) =>
          s.id === id ? { ...s, quantity: s.quantity - 1 } : s
        );
      }
      // If it's the main service, don't remove (though technically remove-btn is hidden for it)
      if (id === service?.id) return prev;
      return prev.filter((s) => s.id !== id);
    });
  };

  const descriptionLines = useMemo(() => {
    if (!service) return [];
    return (service.description || "")
      .replace(/\r\n/g, "\n")
      .split("\n")
      .map((l) => l.trim());
  }, [service]);

  const workIncludesLines = useMemo(() => {
    if (!service?.work_includes) return [];
    return service.work_includes
      .replace(/\r\n/g, "\n")
      .split("\n")
      .map((l) => l.trim());
  }, [service]);

  const workNotIncludedLines = useMemo(() => {
    if (!service?.work_not_included) return [];
    return service.work_not_included
      .replace(/\r\n/g, "\n")
      .split("\n")
      .map((l) => l.trim());
  }, [service]);

  if (isFetching) return (
    <>
      <Header user={user} allServices={allServices} />
      <ServiceDetailSkeleton />
    </>
  );

  if (!service || error) {
    return (
      <>
        <Header user={user} allServices={allServices} />
        <div className="not-found-container">
          <div className="not-found-icon">🏷️</div>
          <h2>Service Not Found</h2>
          <p>The service you are looking for might have been moved or deleted.</p>
          <button className="back-btn" onClick={() => navigate("/services")}>
            Back to Services
          </button>
        </div>
      </>
    );
  }

  return (
    <>
      {/* ✅ Open Graph Tags for WhatsApp/Social Sharing */}
      {service && (
        <Helmet>
          <title>{service.title} | The Neatify Team | Cleaning Services in Hyderabad</title>
          <meta name="description" content={service.description} />
          <meta property="og:title" content={service.title} />
          <meta property="og:description" content={service.description} />
          <meta property="og:image" content={getAbsoluteImageUrl(service.image)} />
          <meta property="og:url" content={window.location.href} />
          <meta property="og:type" content="website" />
          <script type="application/ld+json">
            {`
              {
                "@context": "https://schema.org",
                "@type": "Service",
                "name": "${service.title}",
                "description": "${service.description?.replace(/"/g, '\\"')}",
                "provider": {
                  "@type": "LocalBusiness",
                  "name": "The Neatify Team"
                },
                "areaServed": "Hyderabad",
                "offers": {
                  "@type": "Offer",
                  "price": "${service.price}",
                  "priceCurrency": "INR"
                }
              }
            `}
          </script>
          <script type="application/ld+json">
            {`
              {
                "@context": "https://schema.org",
                "@type": "BreadcrumbList",
                "itemListElement": [
                  {
                    "@type": "ListItem",
                    "position": 1,
                    "name": "Home",
                    "item": "https://www.theneatifyteam.in/"
                  },
                  {
                    "@type": "ListItem",
                    "position": 2,
                    "name": "Services",
                    "item": "https://www.theneatifyteam.in/services"
                  },
                  {
                    "@type": "ListItem",
                    "position": 3,
                    "name": "${service.title}",
                    "item": "${window.location.href}"
                  }
                ]
              }
            `}
          </script>
        </Helmet>
      )}

      {!(showSummary || showAddService || showAddOnDetail) && (
        <Header user={user} allServices={allServices} />
      )}

      <div className="detail-page">
        {/* Unified Back Button (same as Booking) */}
        {!showSummary && (
          <button
            className="back-btn-center-left"
            onClick={() => {
              if (showAddService) {
                setShowAddService(false);
                setShowSummary(true);
              } else {
                navigate(-1);
              }
            }}
            title="Go Back"
          >
            <FiArrowLeft size={22} />
          </button>
        )}

        <ScrollReveal direction={scrollDirection}>
          <div className="hero-section-container">
            <img src={service.image} alt={service.title} className="hero-image" />
            {service.category && (
              <div className="category-glass-tag">
                {service.category}
              </div>
            )}
          </div>
        </ScrollReveal>

        <div className="detail-content">
          <ScrollReveal direction={scrollDirection}>
            <div className="service-header-main">
              <h1>{service.title}</h1>
              <span className="duration-pill-main">{service.duration}</span>
            </div>

            <div className="price-row">
              {service.original_price && (
                <span className="mrp">
                  {currency}{formatPrice(service.original_price)}
                </span>
              )}

              <span className="offer-price">
                {currency}{formatPrice(displayPrice)}
              </span>

              <span className="offer-badge">
                {claimedOffer
                  ? `${claimedOffer.offerPercentage}% OFF`
                  : (service.discount_label || (service.discount_percent > 0 ? `${service.discount_percent}% OFF` : "SPECIAL OFFER"))
                }
              </span>
            </div>

            <div className="actions">
              <button className="primary" onClick={() => setShowSummary(true)}>
                Book Now
              </button>
              <button className="secondary share-btn" onClick={handleShare} title="Share">
                <FiShare2 size={20} />
              </button>
            </div>
          </ScrollReveal>

          {descriptionLines.length > 0 && (
            <ScrollReveal direction={scrollDirection}>
              <div className="info-card description-card">
                <h3><FiInfo className="section-icon" /> Description</h3>
                {descriptionLines.map((line, i) => (
                  <p key={i}>{line}</p>
                ))}
              </div>
            </ScrollReveal>
          )}

          {workIncludesLines.length > 0 && (
            <ScrollReveal direction={scrollDirection}>
              <div className="info-card includes-card">
                <h3 className="work-includes-heading">Work Includes</h3>
                <ul className="icon-list">
                  {workIncludesLines.map((item, i) => (
                    <li key={i}>
                      <FiCheckCircle className="check-icon" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </ScrollReveal>
          )}

          {workNotIncludedLines.length > 0 && (
            <ScrollReveal direction={scrollDirection}>
              <div className="info-card excludes-card">
                <h3 className="work-not-included-heading">Work Not Included</h3>
                <ul className="icon-list">
                  {workNotIncludedLines.map((item, i) => (
                    <li key={i} className="excluded-item">
                      <FiXCircle className="x-icon" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </ScrollReveal>
          )}

          {service.gallery_images?.length > 0 && (
            <ScrollReveal direction={scrollDirection}>
              <h3 className="sectionTitle">How it works</h3>
              <div className="how-it-works-timeline">
                {service.gallery_images.map((img, idx) => {
                  const flowSteps = getServiceFlowSteps(service.title, service.service_type);
                  
                  const step = flowSteps[idx] || {
                    title: `Service Step ${idx + 1}`,
                    desc: "Professional cleaning and detailing."
                  };

                  return (
                    <div key={idx} className="timeline-step">
                      <div className="timeline-icon-container">
                        <img
                          src={getAbsoluteImageUrl(img)}
                          alt={step.title}
                          onClick={() => setActiveLightboxImage(img)}
                          style={{ cursor: "pointer" }}
                        />
                        {idx < service.gallery_images.length - 1 && (
                          <div className="timeline-line"></div>
                        )}
                      </div>
                      <div className="timeline-content">
                        <h4>{step.title}</h4>
                        <p>{step.desc}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScrollReveal>
          )}
        </div>


        {/* ================= LIGHTBOX MODAL ================= */}
        {activeLightboxImage && (
          <div className="lightbox-overlay" onClick={() => setActiveLightboxImage(null)}>
            <button className="lightbox-close" onClick={() => setActiveLightboxImage(null)}>
              <FiX size={24} />
            </button>

            {service.gallery_images?.length > 1 && (
              <>
                {service.gallery_images.indexOf(activeLightboxImage) > 0 && (
                  <button className="lightbox-nav-btn prev" onClick={handlePrevImage}>
                    <FiChevronLeft size={32} />
                  </button>
                )}
                {service.gallery_images.indexOf(activeLightboxImage) < service.gallery_images.length - 1 && (
                  <button className="lightbox-nav-btn next" onClick={handleNextImage}>
                    <FiChevronRight size={32} />
                  </button>
                )}
              </>
            )}

            <div className="lightbox-content" onClick={(e) => e.stopPropagation()}>
              <img src={activeLightboxImage} alt="Fullscreen Workframe" />
            </div>
          </div>
        )}

        {/* ================= SUMMARY MODAL ================= */}
        {showSummary && (
          <div className="modal-overlay">
            <div className="modal-container">
              <button
                className="modal-close"
                onClick={() => setShowSummary(false)}
              />

              <h2 className="modal-title">Appointment Summary</h2>

              <div className="modal-scroll-content">
                {selectedServices.map((s) => (
                  <div key={s.id} className="summary-item">
                    <div className="summary-item-content">
                      <div className="summary-item-header">
                        <div className="summary-info-block">
                          {/* Top Row: Name and Duration (Side-by-side with auto-wrap) */}
                          <div className="summary-title-row">
                            <div className="service-name-wrapper">
                              <span className="service-name">{s.title}</span>
                              {s.quantity > 1 && (
                                <span className="qty-badge">x{s.quantity}</span>
                              )}
                            </div>
                            <div className="summary-duration">
                              <span className="service-time">
                                {formatDuration(s.duration)}
                              </span>
                            </div>
                          </div>

                          {/* Price Row: Always below Name/Duration */}
                          <div className="summary-price-row">
                            <div className="summary-price">
                              {s.original_price && (
                                <span className="mrp">
                                  {getCurrency(s.original_price)}{formatPrice(s.original_price)}
                                </span>
                              )}
                              <span className="offer-price">
                                {getCurrency(s.price)}{formatPrice(s.price)}
                              </span>
                              <span className="offer-tag">
                                {s.discount_label ||
                                  (s.discount_percent > 0
                                    ? `${s.discount_percent}% OFF`
                                    : "5% OFF")}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="summary-item-footer">
                        {s.id !== service.id && (
                          <button
                            className="remove-btn"
                            onClick={() => removeService(s.id)}
                          >
                            Remove
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="modal-footer">
                {addOns.length > 0 && (
                  <button
                    className="add-service-btn"
                    onClick={() => {
                      setShowSummary(false);
                      setShowAddService(true);
                    }}
                  >
                    + Add-ons
                  </button>
                )}

                <button
                  className="schedule-btn"
                  onClick={() =>
                    navigate("/booking", { state: { services: selectedServices } })
                  }
                >
                  Schedule Appointment
                </button>
              </div>
            </div>
          </div>
        )}

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

              <div
                className="modal-scroll-content"
                ref={addonModalRef}
                onScroll={checkScrollToBottom}
              >
                <div className="addon-list-wrapper">
                  {addOns.map((svc) => {
                    const discountPct = svc.discount_percent || (
                      svc.original_price && svc.price
                        ? Math.round((1 - parseFloat(String(svc.price).replace(/[^\d.]/g, "")) / parseFloat(String(svc.original_price).replace(/[^\d.]/g, ""))) * 100)
                        : 0
                    );

                    return (
                      <div key={svc.id} className={`addon-list-item ${selectedServices.some((s) => s.id === svc.id) ? "selected" : ""}`}>
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
                                onClick={async () => {
                                  try {
                                    const { data } = await supabase
                                      .from("add_ons")
                                      .select("*")
                                      .eq("id", svc.id)
                                      .single();
                                    setSelectedAddOn(data || svc);
                                    setShowAddOnDetail(true);
                                  } catch (error) {
                                    console.error("Error fetching add-on details:", error);
                                    setSelectedAddOn(svc);
                                    setShowAddOnDetail(true);
                                  }
                                }}
                              >
                                View
                              </button>

                              {selectedServices.find((s) => s.id === svc.id) ? (
                                <div className="quantity-control-small">
                                  <button
                                    className="qty-btn"
                                    onClick={() => removeService(svc.id)}
                                  >
                                    -
                                  </button>
                                  <span className="qty-count">
                                    {selectedServices.find((s) => s.id === svc.id).quantity}
                                  </span>
                                  <button
                                    className="qty-btn"
                                    onClick={() => addService(svc)}
                                  >
                                    +
                                  </button>
                                </div>
                              ) : (
                                <button
                                  className="add-service-btn-small"
                                  onClick={() => addService(svc)}
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

              {showAddonScrollDown && (
                <div className="addon-scroll-down" onClick={scrollAddonToBottom}>
                  <div className="arrow-down">↓</div>
                  <span>Scroll for More</span>
                </div>
              )}

              <div className="modal-footer">
                <button
                  className="modal-continue-btn"
                  onClick={() => {
                    setShowAddService(false);
                    setShowSummary(true);
                  }}
                >
                  Continue
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ================= ADD-ON DETAIL MODAL — RESTACKED ================= */}
        {showAddOnDetail && selectedAddOn && (
          <div className="modal-overlay">
            <div className="modal-container addon-detail-modal">
              <div className="addon-detail-hero">
                <button
                  className="modal-close-hero"
                  onClick={() => setShowAddOnDetail(false)}
                >
                  <FiX size={18} />
                </button>
                <img src={selectedAddOn.image} alt={selectedAddOn.title} />
              </div>

              <div className="modal-scroll-content">
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
                    {(() => {
                      const discountPct = selectedAddOn.discount_percent || (
                        selectedAddOn.original_price && selectedAddOn.price
                          ? Math.round((1 - parseFloat(String(selectedAddOn.price).replace(/[^\d.]/g, "")) / parseFloat(String(selectedAddOn.original_price).replace(/[^\d.]/g, ""))) * 100)
                          : 0
                      );
                      return discountPct > 0 ? (
                        <span className="offer-tag">{discountPct}% OFF</span>
                      ) : null;
                    })()}
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
                  </div>
                  {/* Padding for bottom scroll */}
                  <div style={{ paddingBottom: '30px' }} />
                </div>
              </div>

            </div>
          </div>
        )}
      </div>
    </>
  );
}