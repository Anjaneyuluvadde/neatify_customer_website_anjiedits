import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { useNavigate, useLocation, useParams } from "react-router-dom";

import { Helmet } from "react-helmet-async";
import { supabase } from "./components/supabaseClient";

import Header from "./components/Header";
import ServiceCard from "./components/ServiceCard";
import FAQ from "./components/FAQ";
import { FiArrowUp, FiSearch, FiX, FiChevronRight, FiChevronLeft, FiDroplet, FiArrowLeft } from "react-icons/fi";

import { calculateServicePrice } from "./utils/priceUtils";
import PromotionalBanners from "./components/PromotionalBanners";
import "./Services.css";

export default function Services({ user }) {
  const navigate = useNavigate();
  const location = useLocation();
  const servicesRef = useRef(null);
  const { categorySlug } = useParams();

  // Slug mapping
  const CATEGORY_TO_SLUG = useMemo(() => ({
    BATHROOM: "bathroom-cleaning",
    KITCHEN: "kitchen-cleaning",
    DEEP_CLEANING: "deep-cleaning",
    OTHER_SERVICES: "other-services",
    BALCONY_CLEANING: "balcony-cleaning",
    ALL: "all-services"
  }), []);

  const normalize = useCallback((str) => str?.toString().toUpperCase().replace(/[\s_]+/g, "").trim(), []);

  const [services, setServices] = useState([]);
  const SLUG_TO_CATEGORY = useMemo(() => {
    const map = Object.entries(CATEGORY_TO_SLUG).reduce((acc, [cat, slug]) => {
      acc[slug] = cat;
      return acc;
    }, {});

    // Add all current service categories to the map dynamically
    services.forEach((s) => {
      const type = s.service_type || s.category;
      if (type) {
        // Standard slug generation matching the tabs logic
        const slug = type.toLowerCase().replace(/[\s_]+/g, "-");
        if (!map[slug]) map[slug] = type;
      }
    });

    return map;
  }, [CATEGORY_TO_SLUG, services]);

  const currentCategoryFromSlug = useMemo(() => 
    categorySlug ? SLUG_TO_CATEGORY[categorySlug] || "ALL" : "ALL"
  , [categorySlug, SLUG_TO_CATEGORY]);

  // SEO Helpers
  const formatName = (str) => {
    if (str === "ALL") return "Cleaning Services";
    return str.toString().toLowerCase().replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase());
  };

  const getPageSEOMetadata = useMemo(() => {
    const name = formatName(currentCategoryFromSlug);
    if (currentCategoryFromSlug === "ALL") {
      return {
        title: "The Neatify Team | Top-Rated Cleaning Services in Hyderabad",
        description: "Book professional bathroom cleaning, kitchen cleaning, and deep cleaning services in Hyderabad, Pragathi Nagar and Bachupally. Experience premium quality home cleaning with The Neatify Team.",
        canonical: "https://www.theneatifyteam.in/services"
      };
    }
    return {
      title: `${name} in Hyderabad | Professional Cleaning Services`,
      description: `Book top-rated ${name.toLowerCase()} in Hyderabad. Expert cleaners for your home in Pragathi Nagar, Bachupally and beyond. Accurate pricing, verified professional service.`,
      canonical: `https://www.theneatifyteam.in/services/${categorySlug}`
    };
  }, [currentCategoryFromSlug, categorySlug]);
  const [activeCategory, setActiveCategory] = useState(currentCategoryFromSlug);
  const activeCategoryNormalized = useMemo(() => normalize(activeCategory), [activeCategory, normalize]);
  const [loading, setLoading] = useState(true);
  const [showCleaningModal, setShowCleaningModal] = useState(false);
  const [showInstaHelpModal, setShowInstaHelpModal] = useState(false);
  const [showApplianceModal, setShowApplianceModal] = useState(false);
  const [showHairSpaModal, setShowHairSpaModal] = useState(false);
  const [showPestControlModal, setShowPestControlModal] = useState(false);
  const [dynamicCategoryName, setDynamicCategoryName] = useState("");
  const [mainCategories, setMainCategories] = useState([]);
  const [expandedCategories, setExpandedCategories] = useState(() => {
    try {
      const saved = sessionStorage.getItem("expandedCategories");
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });
  const [cardsPerRow, setCardsPerRow] = useState(() => {
    if (typeof window !== 'undefined') {
      if (window.innerWidth <= 640) return 1;
      if (window.innerWidth <= 1024) return 2;
      return 3;
    }
    return 3;
  });
  const searchParams = useMemo(() => new URLSearchParams(location.search), [location.search]);

  useEffect(() => {
    if (loading || mainCategories.length === 0) return;

    const modalType = searchParams.get("modal");
    const catParam = searchParams.get("cat");
    const hasCategory = (name) => mainCategories.some(c => c.name === name);

    if (modalType === "cleaning" && hasCategory("Cleaning Services")) {
      setShowCleaningModal(true);
    } else if (modalType === "instahelp") {
      const targetCat = catParam 
        ? mainCategories.find(c => c.name === decodeURIComponent(catParam))
        : mainCategories.find(c => 
            c.name !== "Cleaning Services" && 
            c.name !== "Appliance Repair" && 
            c.name !== "Hair Spa" && 
            c.name !== "Pest Control"
          );
      if (targetCat) {
        setDynamicCategoryName(targetCat.name);
        setShowInstaHelpModal(true);
      }
    } else if (modalType === "appliance" && hasCategory("Appliance Repair")) {
      setShowApplianceModal(true);
    } else if (modalType === "hairspa" && hasCategory("Hair Spa")) {
      setShowHairSpaModal(true);
    } else if (modalType === "pestcontrol" && hasCategory("Pest Control")) {
      setShowPestControlModal(true);
    }
  }, [searchParams, mainCategories, loading]);

  const isDedicated = searchParams.get("mode") === "dedicated";
  const [searchText, setSearchText] = useState("");
  const [error, setError] = useState(null);
  const [scrollDirection, setScrollDirection] = useState("down");
  const [showGoUp, setShowGoUp] = useState(false);
  const lastScrollY = useRef(0);

  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      if (currentScrollY > lastScrollY.current) {
        setScrollDirection("down");
      } else if (currentScrollY < lastScrollY.current) {
        setScrollDirection("up");
      }
      lastScrollY.current = currentScrollY;
      setShowGoUp(currentScrollY > 400);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const [heroImages, setHeroImages] = useState([]);
  const [currentHero, setCurrentHero] = useState(0);

  const fetchMainCategories = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("main_categories")
        .select("*")
        .order("sort_order", { ascending: true });

      if (error) throw error;
      setMainCategories(data || []);
    } catch (err) {
      console.error("Error fetching main categories:", err);
    }
  }, []);

  // App Popup State
  const [popupsQueue, setPopupsQueue] = useState([]);
  const [showPopup, setShowPopup] = useState(false);
  const [currentPopupIndex, setCurrentPopupIndex] = useState(0);
  const [isPopupPaused, setIsPopupPaused] = useState(false);
  const [modalIcons, setModalIcons] = useState({});

  const fetchModalIcons = useCallback(async () => {
    const categories = ["Bathroom", "Deep Cleaning", "Kitchen", "Balcony Cleaning", "Other Services", "Frontload", "Asdfg", "Other", "Hair Cleaning", "Hair Wash"];
    const iconsMap = {};

    try {
      for (const cat of categories) {
        // Frontload is specifically inside main/ folder
        const fetchPath = cat === "Frontload" ? `main/${cat}` : cat;
        
        const { data, error } = await supabase.storage
          .from("category-icons")
          .list(fetchPath);

        if (error) {
          console.error(`Error listing icons for ${cat}:`, error);
          continue;
        }

        if (data && data.length > 0) {
          // Prioritize files that start with the category name (e.g., "kitchen .png" over "ChatGPT Image...")
          const imgFile = data.find(f => f.name.toLowerCase().replace(/\s+/g, '').startsWith(cat.toLowerCase().replace(/\s+/g, ''))) || 
                          data.find(f => f.name.match(/\.(png|jpg|jpeg|svg|webp)$/i));
          if (imgFile) {
            const { data: { publicUrl } } = supabase.storage
              .from("category-icons")
              .getPublicUrl(`${fetchPath}/${imgFile.name}`);
            iconsMap[cat] = publicUrl;
          }
        }
      }
      setModalIcons(iconsMap);
    } catch (err) {
      console.error("Error fetching modal icons:", err);
    }
  }, []);


  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };



  // Priority: app_popups (announcements) take over offers.
  // If active announcements exist → show only them.
  // If no announcements → fall back to service offers.
  const fetchPopups = useCallback(async () => {
    try {
      const dismissedPopups = JSON.parse(sessionStorage.getItem("dismissedPopups") || "[]");

      // --- Step 1: Check for active announcements ---
      const { data: annData, error: annError } = await supabase
        .from("app_popups")
        .select("*")
        .eq("is_active", true)
        .order("created_at", { ascending: false });

      if (annError) throw annError;

      const activeAnnouncements = (annData || []).filter(
        ann => !dismissedPopups.includes(ann.id)
      );

      if (activeAnnouncements.length > 0) {
        // Resolve image URLs from app_popups bucket
        const resolvedAnnouncements = activeAnnouncements.map(ann => {
          let resolvedUrl = null;
          if (ann.image_url) {
            if (ann.image_url.startsWith('http')) {
              resolvedUrl = ann.image_url;
            } else {
              const { data: img } = supabase.storage
                .from("app_popups")
                .getPublicUrl(ann.image_url);
              resolvedUrl = img?.publicUrl || null;
            }
          }
          return { ...ann, image_url: resolvedUrl, isAnnouncement: true };
        });

        setPopupsQueue(resolvedAnnouncements);
        setShowPopup(true);
        return; // ← Announcements found: skip offers
      }

      // --- Step 2: No announcements → fall back to service offers ---
      // Only skip if already shown this session (not per-ID, so admin re-enable always works)
      const offersAlreadyShown = sessionStorage.getItem("offersShown") === "true";
      if (offersAlreadyShown) return;

      const { data: offerData, error: offerError } = await supabase
        .from("offers")
        .select("*")
        .eq("is_offer_enabled", true)
        .order("created_at", { ascending: false });

      if (offerError) throw offerError;

      const activeOffers = offerData || [];

      if (activeOffers.length > 0) {
        const offerListSlide = {
          id: 'grouped-offers-list',
          isOfferList: true,
          offers: activeOffers,
          title: "Special Offers"
        };
        setPopupsQueue([offerListSlide]);
        setShowPopup(true);
      }
    } catch (err) {
      console.error("Error fetching popups:", err);
    }
  }, []);

  const handleClosePopup = async () => {
    const dismissedPopups = JSON.parse(sessionStorage.getItem("dismissedPopups") || "[]");

    const isShowingAnnouncement = popupsQueue.some(p => p.isAnnouncement);

    popupsQueue.forEach(popup => {
      // Dismiss announcements per-ID
      if (popup.isAnnouncement && popup.id && !dismissedPopups.includes(popup.id)) {
        dismissedPopups.push(popup.id);
      }
      // For offers: mark session as shown
      if (popup.isOfferList) {
        sessionStorage.setItem("offersShown", "true");
      }
    });

    sessionStorage.setItem("dismissedPopups", JSON.stringify(dismissedPopups));

    // If user clicked X on App Announcements, open Special Offers next!
    if (isShowingAnnouncement) {
      const offersAlreadyShown = sessionStorage.getItem("offersShown") === "true";
      if (!offersAlreadyShown) {
        try {
          const { data: offerData } = await supabase
            .from("offers")
            .select("*")
            .eq("is_offer_enabled", true)
            .order("created_at", { ascending: false });

          if (offerData && offerData.length > 0) {
            setPopupsQueue([{
              id: 'grouped-offers-list',
              isOfferList: true,
              offers: offerData,
              title: "Special Offers"
            }]);
            setCurrentPopupIndex(0);
            return;
          }
        } catch (err) {
          console.error("Error fetching offers on close:", err);
        }
      }
    }

    setShowPopup(false);
    setPopupsQueue([]);
    setCurrentPopupIndex(0);
  };

  const handleNextPopup = useCallback((e) => {
    if (e) e.stopPropagation();
    if (popupsQueue.length > 0) {
      setCurrentPopupIndex(curr => (curr + 1) % popupsQueue.length);
    }
  }, [popupsQueue.length]);

  const handlePrevPopup = useCallback((e) => {
    if (e) e.stopPropagation();
    if (popupsQueue.length > 0) {
      setCurrentPopupIndex(curr => (curr - 1 + popupsQueue.length) % popupsQueue.length);
    }
  }, [popupsQueue.length]);

  // Auto-slide Logic
  useEffect(() => {
    let timer;
    if (showPopup && popupsQueue.length > 1 && !isPopupPaused) {
      timer = setInterval(() => {
        handleNextPopup();
      }, 5000); // Auto-slide every 5 seconds
    }
    return () => clearInterval(timer);
  }, [showPopup, popupsQueue.length, isPopupPaused, handleNextPopup]);

  const handleClaimOffer = (offer) => {
    // 1. Find the matching service
    const matchingService = services.find(s =>
      (s.service_type === offer.service_type || s.category === offer.service_type) &&
      s.title === offer.title
    );

    if (matchingService) {
      // 2. Persist claimed offer for the session (Calculated from MRP later)
      sessionStorage.setItem("claimedOffer", JSON.stringify({
        serviceId: matchingService.id,
        serviceTitle: matchingService.title,
        offerPercentage: offer.offer_percentage,
        offerPrice: offer.offer_price || offer.fixed_price, // Support either column name
        claimedAt: new Date().toISOString()
      }));

      // 3. Dismiss popup (add to session storage)
      const dismissedPopups = JSON.parse(sessionStorage.getItem("dismissedPopups") || "[]");
      if (!dismissedPopups.includes(offer.id)) {
        dismissedPopups.push(offer.id);
        sessionStorage.setItem("dismissedPopups", JSON.stringify(dismissedPopups));
      }

      // 4. Clear queue and hide
      setPopupsQueue([]);
      setShowPopup(false);

      // 5. Navigate to details
      navigate(`/service/${matchingService.slug || matchingService.id}`, {
        state: {
          service: matchingService,
          allServices: services,
          lastCategory: activeCategory
        },
      });
    } else {
      console.warn("No matching service found for offer:", offer);
      handleClosePopup();
    }
  };

  const fetchServices = useCallback(async () => {
    try {
      // 1. Fetch services
      const { data: servicesData, error: servicesError } = await supabase.from("services").select("*");
      if (servicesError) throw servicesError;

      // 2. Fetch active offers
      const { data: offersData, error: offersError } = await supabase
        .from("offers")
        .select("*")
        .eq("is_offer_enabled", true)
        .order("created_at", { ascending: false });

      if (offersError) {
        console.warn("Could not fetch offers for services list:", offersError);
      }

      const claimedOffer = JSON.parse(sessionStorage.getItem("claimedOffer") || "null");

      const transformed = (servicesData || []).map(s => {
        const pricing = calculateServicePrice(s, offersData, claimedOffer);

        return {
          ...s,
          price: pricing.price,
          discount_percent: pricing.discount_percent,
          discount_label: pricing.discount_label
        };
      });

      setServices(transformed);
    } catch (err) {
      console.error("Error in fetchServices:", err);
      setError("Failed to load services.");
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchHeroImages = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("web-hero-images")
        .select("*")
        .eq("is_active", true)
        .order("priority", { ascending: true });

      if (error || !data) {
        console.error("Error fetching hero metadata:", error);
        return;
      }

      const urls = data
        .map((row) => {
          const path = row.image_path || row.image_url;
          if (!path) return null;

          if (path.startsWith("http")) {
            return path;
          }

          const { data: img } = supabase.storage
            .from("web-hero-images")
            .getPublicUrl(path);

          return img?.publicUrl;
        })
        .filter(Boolean);

      setHeroImages(urls);
    } catch (err) {
      console.error("Hero fetch exception:", err);
    }
  }, []);

  useEffect(() => {
    fetchServices();
    fetchHeroImages();
    fetchPopups();
    fetchMainCategories();
    fetchModalIcons();
  }, [fetchServices, fetchHeroImages, fetchPopups, fetchMainCategories, fetchModalIcons]);

  // Sync activeCategory with URL
  useEffect(() => {
    setActiveCategory(currentCategoryFromSlug);
  }, [currentCategoryFromSlug]);

  // Removed resetting expandedCategories on activeCategory change to preserve state
  useEffect(() => {
    // Do nothing, keep expanded state intact
  }, [activeCategory]);

  // Track screen width for responsive card count
  useEffect(() => {
    const updateCardsPerRow = () => {
      if (window.innerWidth <= 640) setCardsPerRow(1);
      else if (window.innerWidth <= 1024) setCardsPerRow(2);
      else setCardsPerRow(3);
    };
    window.addEventListener('resize', updateCardsPerRow);
    return () => window.removeEventListener('resize', updateCardsPerRow);
  }, []);

  // Toggle expand/collapse for a category
  const toggleCategoryExpand = useCallback((category) => {
    setExpandedCategories(prev => {
      const isCurrentlyExpanded = prev[category];
      if (isCurrentlyExpanded) {
        // Collapsing: scroll back to the category section or top of services if ALL
        setTimeout(() => {
          const el = category === "ALL"
            ? servicesRef.current
            : document.getElementById(`category-${category.replace(/[\s_]+/g, '-')}`);
          if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 100);
      }
      const newState = { ...prev, [category]: !isCurrentlyExpanded };
      sessionStorage.setItem("expandedCategories", JSON.stringify(newState));
      return newState;
    });
  }, []);

  // Handle scroll position restoration
  useEffect(() => {
    if (!loading && services.length > 0) {
      const savedScrollY = sessionStorage.getItem("servicesScrollY");
      if (savedScrollY !== null) {
        setTimeout(() => {
          window.scrollTo({ top: parseInt(savedScrollY, 10), behavior: "instant" });
          sessionStorage.removeItem("servicesScrollY"); // Clean up after restoring
        }, 150);
      } else if (location.state?.scrollToFAQs) {
        setTimeout(() => {
          document.getElementById("faq-section")?.scrollIntoView({ behavior: "smooth", block: "start" });
          navigate(location.pathname, { replace: true, state: {} });
        }, 100);
      } else if (location.state?.fromDetail) {
        setTimeout(() => {
          servicesRef.current?.scrollIntoView({ behavior: "smooth" });
          navigate(location.pathname, { replace: true, state: {} });
        }, 100);
      }
    }
  }, [loading, services, location.state, navigate, location.pathname]);

  useEffect(() => {
    if (heroImages.length > 0) setCurrentHero(0);
  }, [heroImages]);

  useEffect(() => {
    if (heroImages.length === 0) return;
    const interval = setInterval(() => {
      setCurrentHero((prev) => (prev + 1) % heroImages.length);
    }, 4000);
    return () => clearInterval(interval);
  }, [heroImages]);



  useEffect(() => {
    if (searchText.trim().length > 0) {
      setActiveCategory("ALL");
    }
  }, [searchText]);

  let filteredServices =
    (activeCategory === "ALL" || searchText.trim().length > 0)
      ? services
      : services.filter(
        (s) => normalize(s.service_type || s.category) === activeCategoryNormalized
      );

  filteredServices = filteredServices.filter((s) => {
    const input = searchText.toLowerCase().trim();
    if (!input) return true;
    return (
      s.title?.toLowerCase().includes(input) ||
      s.description?.toLowerCase().includes(input) ||
      (s.service_type || s.category)?.toLowerCase().includes(input)
    );
  });

  const groupedServices = useMemo(() => {
    const grouped = {};
    filteredServices.forEach((service) => {
      const category = service.service_type || service.category || "Other";
      if (!grouped[category]) grouped[category] = [];
      grouped[category].push(service);
    });

    const PRIORITY = {
      BATHROOM: 1,
      KITCHEN: 2,
      DEEP_CLEANING: 3,
      OTHER_SERVICES: 4,
      BALCONY_CLEANING: 5
    };

    // Sort the categories (keys) based on priority
    const sortedCategories = Object.keys(grouped).sort((a, b) => {
      const pA = PRIORITY[normalize(a)] ?? 9999;
      const pB = PRIORITY[normalize(b)] ?? 9999;
      if (pA !== pB) return pA - pB;

      // Fallback: use category_order of the first service in each category
      const orderA = grouped[a][0]?.category_order ?? 9999;
      const orderB = grouped[b][0]?.category_order ?? 9999;
      return orderA - orderB;
    });

    const sortedGrouped = {};
    sortedCategories.forEach((cat) => {
      sortedGrouped[cat] = grouped[cat].sort(
        (a, b) => (a.sort_order ?? 9999) - (b.sort_order ?? 9999)
      );
    });

    return sortedGrouped;
  }, [filteredServices, normalize]);

  // Helper to get sub-categories for a specific main category
  const getSubCategories = useCallback((mainCatName) => {
    const mainCat = mainCategories.find(c => c.name === mainCatName);
    if (!mainCat) return [];
    
    const catServices = services.filter(s => s.main_category_id === mainCat.id);
    const uniqueTypes = [...new Set(catServices.map(s => s.service_type))];
    
    return uniqueTypes.map(type => {
      const firstService = catServices.find(s => s.service_type === type);
      return {
        name: firstService?.title || type.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase()),
        label: type.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase()),
        value: type,
        slug: type.toLowerCase().replace(/[\s_]+/g, "-"),
        icon_url: firstService?.category_icon_url
      };
    });
  }, [mainCategories, services]);



  return (
    <div className="page">
      {showHairSpaModal && (
        <div className="cleaning-modal-backdrop" onClick={() => setShowHairSpaModal(false)}>
          <div className="cleaning-modal-container" onClick={(e) => e.stopPropagation()}>
            <div className="cleaning-modal-header">
              <h2>Hair Spa</h2>
              <button className="cleaning-modal-close" onClick={() => setShowHairSpaModal(false)}>
                <FiX size={24} />
              </button>
            </div>


            <div className="cleaning-modal-grid">
              {[
                { name: "Hair Cleaning", slug: "hair-cleaning" },
                { name: "Hair Wash", slug: "hair-wash" }
              ].map((sub, idx) => {
                const iconUrl = modalIcons[sub.name];
                return (
                  <div 
                    key={idx} 
                    className="cleaning-modal-item"
                    onClick={() => {
                      navigate(`/services/${sub.slug}?mode=dedicated`);
                      setShowHairSpaModal(false);
                    }}
                  >
                    <div className="cleaning-modal-item-icon">
                      {iconUrl ? (
                        <img src={iconUrl} alt={sub.name} />
                      ) : (
                        <div className="cleaning-modal-icon-placeholder" />
                      )}
                    </div>
                    <span className="cleaning-modal-item-name">{sub.name}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {showApplianceModal && (
        <div className="cleaning-modal-backdrop" onClick={() => setShowApplianceModal(false)}>
          <div className="cleaning-modal-container" onClick={(e) => e.stopPropagation()}>
            <div className="cleaning-modal-header">
              <h2>Appliance Repair</h2>
              <button className="cleaning-modal-close" onClick={() => setShowApplianceModal(false)}>
                <FiX size={24} />
              </button>
            </div>


            <div className="cleaning-modal-grid">
              {[
                { name: "Frontload", slug: "frontload" }
              ].map((sub, idx) => {
                const iconUrl = modalIcons[sub.name];
                return (
                  <div 
                    key={idx} 
                    className="cleaning-modal-item"
                    onClick={() => {
                      navigate(`/services/${sub.slug}?mode=dedicated`);
                      setShowApplianceModal(false);
                    }}
                  >
                    <div className="cleaning-modal-item-icon">
                      {iconUrl ? (
                        <img src={iconUrl} alt={sub.name} />
                      ) : (
                        <div className="cleaning-modal-icon-placeholder" />
                      )}
                    </div>
                    <span className="cleaning-modal-item-name">{sub.name}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {showInstaHelpModal && (
        <div className="cleaning-modal-backdrop" onClick={() => setShowInstaHelpModal(false)}>
          <div className="cleaning-modal-container" onClick={(e) => e.stopPropagation()}>
            <div className="cleaning-modal-header">
              <h2>{dynamicCategoryName || "Services"}</h2>
              <button className="cleaning-modal-close" onClick={() => setShowInstaHelpModal(false)}>
                <FiX size={24} />
              </button>
            </div>


            <div className="cleaning-modal-grid">
              {getSubCategories(dynamicCategoryName).map((item, idx) => {
                const iconUrl = item.icon_url;
                return (
                  <div
                    key={idx}
                    className="cleaning-modal-item"
                    onClick={() => {
                      setShowInstaHelpModal(false);
                      navigate(`/services/${item.slug}?mode=dedicated`);
                    }}
                  >
                    <div className="cleaning-modal-item-icon">
                      {iconUrl ? (
                        <img src={iconUrl} alt={item.name} />
                      ) : (
                        <div className="cleaning-modal-icon-placeholder" />
                      )}
                    </div>
                    <span className="cleaning-modal-item-name">{item.name}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
      {showPopup && popupsQueue.length > 0 && (
        <div className="popup-backdrop" onClick={handleClosePopup}>
          <div
            className="popup-slideshow-container static-list-container"
            onClick={(e) => e.stopPropagation()}
            onMouseEnter={() => setIsPopupPaused(true)}
            onMouseLeave={() => setIsPopupPaused(false)}
          >
            <button className="popup-close-btn-fixed" onClick={handleClosePopup}>
              <FiX size={24} />
            </button>

            {/* Navigation Arrows if more than one popup */}
            {popupsQueue.length > 1 && (
              <>
                <button className="popup-nav-btn prev" onClick={handlePrevPopup}>
                  <FiChevronLeft size={22} />
                </button>
                <button className="popup-nav-btn next" onClick={handleNextPopup}>
                  <FiChevronRight size={22} />
                </button>
              </>
            )}

            <div className="single-slide-wrapper">
              <div className="popup-slide-track" style={{ transform: `translateX(-${currentPopupIndex * 100}%)` }}>
                {popupsQueue.map((popup, idx) => (
                  <div key={popup.id} className="popup-slide">
                    <div className={`popup-container-inner ${popup.isOfferList ? 'offer-list-layout' : popup.isAnnouncement ? 'announcement-layout' : ''}`}>
                      <div className="popup-slide-content">
                        {popup.isOfferList ? (
                          <div className="popup-offer-list-redesign">
                            <div className="popup-list-header">
                              <h2>🎉 {popup.title || "Special Offers"}</h2>
                            </div>
                            <div className="offer-items-container">
                              {popup.offers.map((offer) => (
                                <div key={offer.id} className="reference-offer-item" onClick={() => handleClaimOffer(offer)}>
                                  <div className="offer-main-content">
                                    <span className="offer-category-tag">{offer.service_type?.replace(/_/g, " ").toUpperCase()}</span>
                                    <h3 className="offer-item-title">{offer.title}</h3>
                                    <p className="offer-item-subtitle">use this offer</p>
                                  </div>
                                  <div className="offer-right-content">
                                    <div className="reference-discount-badge">
                                      {offer.offer_percentage}% OFF
                                    </div>
                                    <FiChevronRight size={24} className="offer-arrow-icon" />
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        ) : popup.isAnnouncement ? (
                          <div className="popup-announcement-redesign">
                            {popup.image_url && (
                              <div className="announcement-image-wrapper">
                                <img
                                  src={popup.image_url}
                                  alt={popup.title}
                                  className="announcement-img"
                                  onError={(e) => { e.currentTarget.style.display = 'none'; }}
                                />
                              </div>
                            )}
                            <div className="announcement-text-content">
                              <span className="announcement-tag">{popup.type || "NEW"}</span>
                              <h2 className="announcement-title">{popup.title}</h2>
                              {popup.description && (
                                <p className="announcement-desc">{popup.description}</p>
                              )}
                              <button className="announcement-action-btn" onClick={idx === popupsQueue.length - 1 ? handleClosePopup : handleNextPopup}>
                                {idx === popupsQueue.length - 1 ? "Got it!" : "Next"}
                              </button>
                            </div>
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Indicators / Dots */}
            {popupsQueue.length > 1 && (
              <div className="popup-indicators">
                {popupsQueue.map((_, idx) => (
                  <div
                    key={idx}
                    className={`indicator-dot ${idx === currentPopupIndex ? 'active' : ''}`}
                    onClick={() => setCurrentPopupIndex(idx)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      )}
      <Helmet>
        <title>{getPageSEOMetadata.title}</title>
        <meta name="description" content={getPageSEOMetadata.description} />
        <link rel="canonical" href={getPageSEOMetadata.canonical} />
        <meta property="og:title" content={getPageSEOMetadata.title} />
        <meta property="og:description" content={getPageSEOMetadata.description} />
        <meta property="og:url" content={getPageSEOMetadata.canonical} />
        <meta property="og:type" content="website" />
        <script type="application/ld+json">
          {`
            {
              "@context": "https://schema.org",
              "@type": "LocalBusiness",
              "name": "The Neatify Team",
              "image": "https://www.theneatifyteam.in/logo192.png",
              "@id": "https://www.theneatifyteam.in/",
              "url": "https://www.theneatifyteam.in/",
              "telephone": "+917617618567",
              "address": {
                "@type": "PostalAddress",
                "streetAddress": "Pragathi Nagar, Bachupally",
                "addressLocality": "Hyderabad",
                "postalCode": "500090",
                "addressRegion": "Telangana",
                "addressCountry": "IN"
              },
              "geo": {
                "@type": "GeoCoordinates",
                "latitude": 17.5342,
                "longitude": 78.3702
              },
              "priceRange": "$$",
              "openingHoursSpecification": {
                "@type": "OpeningHoursSpecification",
                "dayOfWeek": [
                  "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"
                ],
                "opens": "08:00",
                "closes": "20:00"
              }
            }
          `}
        </script>
        {/* Breadcrumb Schema */}
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
                }
                ${categorySlug ? `, {
                  "@type": "ListItem",
                  "position": 3,
                  "name": "${formatName(currentCategoryFromSlug)}",
                  "item": "${getPageSEOMetadata.canonical}"
                }` : ""}
              ]
            }
          `}
        </script>
      </Helmet>

      {!isDedicated && <Header searchText={searchText} setSearchText={setSearchText} user={user} allServices={services} />}

      {!isDedicated && heroImages.length > 0 && (
        <div className="hero-container">
          <div
            className="hero"
            style={{ backgroundImage: `url(${heroImages[currentHero]})` }}
          />
          <div className="hero-dots">
            {heroImages.map((_, index) => (
              <span
                key={index}
                className={`dot ${index === currentHero ? "active" : ""}`}
                onClick={() => setCurrentHero(index)}
              />
            ))}
          </div>
        </div>
      )}

      {!isDedicated && (
        <PromotionalBanners user={user} />
      )}

      <div id="services-section" ref={servicesRef} style={{ scrollMarginTop: "90px" }}>
        
        {isDedicated && (
          <div className="category-page-header-unified">
            <button className="category-back-btn-simple" onClick={() => {
              // Dynamically find which main category this belongs to
              const currentService = services.find(s => 
                normalize(s.service_type || s.category) === normalize(currentCategoryFromSlug)
              );

              if (currentService) {
                const mainCat = mainCategories.find(c => c.id === currentService.main_category_id);
                
                if (mainCat?.name === "Cleaning Services") {
                  navigate("/services?modal=cleaning");
                  return;
                } else if (mainCat && 
                           mainCat.name !== "Cleaning Services" && 
                           mainCat.name !== "Appliance Repair" && 
                           mainCat.name !== "Hair Spa" && 
                           mainCat.name !== "Pest Control") {
                  navigate(`/services?modal=instahelp&cat=${encodeURIComponent(mainCat.name)}`);
                  return;
                } else if (mainCat?.name === "Appliance Repair") {
                  navigate("/services?modal=appliance");
                  return;
                } else if (mainCat?.name === "Hair Spa") {
                  navigate("/services?modal=hairspa");
                  return;
                } else if (mainCat?.name === "Pest Control") {
                  navigate("/services?modal=pestcontrol");
                  return;
                }
              }

              // Fallback
              navigate("/services");
            }}>
              <FiArrowLeft size={28} />
            </button>
            <h1 className="category-page-title-unified">
              {formatName(currentCategoryFromSlug)}
            </h1>
          </div>
        )}

        {!isDedicated && (
          <section className="explore-services-container">
            <div className="explore-services-header">
              <h2 className="explore-services-heading">Explore all services</h2>
              <p className="explore-services-subheading">Book trusted experts in minutes</p>
            </div>
            <div className="explore-services-grid">
              {mainCategories.map((cat, index) => {
                const descriptions = {
                  "Cleaning Services": "Professional home cleaning solutions",
                  "Pest Control": "Safe & effective pest control services"
                };
                return (
                  <div 
                    key={cat.id || index} 
                    className="explore-service-item"
                    onClick={() => {
                      if (cat.name === "Cleaning Services") {
                        setShowCleaningModal(true);
                      } else if (cat.name === "Appliance Repair") {
                        setShowApplianceModal(true);
                      } else if (cat.name === "Hair Spa") {
                        setShowHairSpaModal(true);
                      } else if (cat.name === "Pest Control") {
                        setShowPestControlModal(true);
                      } else {
                        // Dynamically open modal for any other category
                        setDynamicCategoryName(cat.name);
                        setShowInstaHelpModal(true);
                      }
                    }}
                  >
                    <div className="explore-service-icon-box">
                      {cat.icon_url ? (
                        <img src={cat.icon_url} alt={cat.name} className="explore-service-icon-img" />
                      ) : (
                        <FiDroplet />
                      )}
                    </div>
                    <div className="explore-service-info">
                      <h3 className="explore-service-label">{cat.name}</h3>
                      <p className="explore-service-desc">
                        {descriptions[cat.name] || "Reliable and high-quality services"}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}
        
        {/* Pest Control Selection Modal */}
        {showPestControlModal && (
          <div className="cleaning-modal-backdrop" onClick={() => setShowPestControlModal(false)}>
            <div className="cleaning-modal-container" onClick={(e) => e.stopPropagation()}>
              <div className="cleaning-modal-header">
                <h2>Pest control</h2>
                <button className="cleaning-modal-close" onClick={() => setShowPestControlModal(false)}>
                  <FiX size={24} />
                </button>
              </div>


              <div className="cleaning-modal-grid">
                {getSubCategories("Pest Control").map((sub, idx) => {
                  const iconUrl = sub.icon_url;

                  return (
                    <div 
                      key={idx} 
                      className="cleaning-modal-item"
                      onClick={() => {
                        navigate(`/services/${sub.slug}?mode=dedicated`);
                        setShowPestControlModal(false);
                      }}
                    >
                      <div className="cleaning-modal-item-icon">
                        {iconUrl ? (
                          <img src={iconUrl} alt={sub.name} />
                        ) : (
                          <div className="cleaning-modal-icon-placeholder" />
                        )}
                      </div>
                      <span className="cleaning-modal-item-name">{sub.name}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Cleaning Services Selection Modal */}
        {showCleaningModal && (
          <div className="cleaning-modal-backdrop" onClick={() => setShowCleaningModal(false)}>
            <div className="cleaning-modal-container" onClick={(e) => e.stopPropagation()}>
              <div className="cleaning-modal-header">
                <h2>Cleaning Services</h2>
                <button className="cleaning-modal-close" onClick={() => setShowCleaningModal(false)}>
                  <FiX size={24} />
                </button>
              </div>


              <div className="cleaning-modal-grid">
                {[
                  { name: "Bathroom", slug: "bathroom-cleaning" },
                  { name: "Deep Cleaning", slug: "deep-cleaning" },
                  { name: "Kitchen", slug: "kitchen-cleaning" },
                  { name: "Balcony Cleaning", slug: "balcony-cleaning" },
                  { name: "Other Services", slug: "other-services" },
                ].map((sub, idx) => {
                  const iconUrl = modalIcons[sub.name];

                  return (
                    <div 
                      key={idx} 
                      className="cleaning-modal-item"
                      onClick={() => {
                        navigate(`/services/${sub.slug}?mode=dedicated`);
                        setShowCleaningModal(false);
                      }}
                    >
                      <div className="cleaning-modal-item-icon">
                        {iconUrl ? (
                          <img src={iconUrl} alt={sub.name} />
                        ) : (
                          <div className="cleaning-modal-icon-placeholder" />
                        )}
                      </div>
                      <span className="cleaning-modal-item-name">{sub.name}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {(isDedicated || searchText.trim() !== "") && (
          <>

        {loading ? (
          <div className="loader">Loading services...</div>
        ) : error ? (
          <div className="error">{error}</div>
        ) : filteredServices.length === 0 ? (
          <div className="no-services-container">
            <div className="no-services-content">
              <div className="no-services-icon-wrapper">
                <FiSearch size={48} />
              </div>
              <h3>No services found</h3>
              <p>
                We couldn't find any services matching "{searchText}". Try searching for something else or clear your search.
              </p>
              <button className="clear-search-btn" onClick={() => setSearchText("")}>
                Clear Search
              </button>
            </div>
          </div>
        ) : activeCategory === "ALL" ? (
          <>
            {(() => {
              const combinedItems = Object.values(groupedServices).flat();
              const isExpanded = expandedCategories["ALL"];
              const initialRows = 1;
              const initialVisibleCount = cardsPerRow * initialRows;
              const hasMore = combinedItems.length > initialVisibleCount;
              const visibleItems = isExpanded ? combinedItems : combinedItems.slice(0, initialVisibleCount);

              return (
                <section
                  className="service-category all-services-category"
                  id="category-all-services"
                  style={{ scrollMarginTop: '100px' }}
                >
                  <div className="services-grid">
                    {visibleItems.map((service) => (
                      <ServiceCard
                        key={service.id}
                        service={service}
                        scrollDirection={scrollDirection}
                        onView={() => {
                          sessionStorage.setItem("servicesScrollY", window.scrollY.toString());
                          navigate(`/service/${service.slug || service.id}`, {
                            state: {
                              service,
                              allServices: services,
                              lastCategory: activeCategory
                            },
                          });
                        }}
                      />
                    ))}
                  </div>

                  {hasMore && (
                    <div className="view-all-btn-wrapper">
                      <button
                        className="view-all-services-btn"
                        onClick={() => toggleCategoryExpand("ALL")}
                      >
                        {isExpanded ? "Show Less" : "View All Services"}
                      </button>
                    </div>
                  )}
                </section>
              );
            })()}

            {showGoUp && (
              <div className="services-go-up-wrapper">
                <button
                  className="services-go-up"
                  onClick={scrollToTop}
                  aria-label="Go to top"
                >
                  <FiArrowUp />
                </button>
              </div>
            )}
          </>
        ) : (
          <>
            {Object.entries(groupedServices).map(([category, items]) => {
              const isExpanded = expandedCategories[category];
              const initialRows = 1;
              const initialVisibleCount = cardsPerRow * initialRows;
              const hasMore = items.length > initialVisibleCount;
              const visibleItems = isExpanded ? items : items.slice(0, initialVisibleCount);

              return (
                <section
                  key={category}
                  className="service-category"
                  id={`category-${category.replace(/[\s_]+/g, '-')}`}
                  style={{ scrollMarginTop: '100px' }}
                >
                  {!isDedicated && (
                    <h1 className="category-title">
                      {category
                        .toLowerCase()
                        .replace(/_/g, " ")
                        .replace(/\b\w/g, (c) => c.toUpperCase())}
                    </h1>
                  )}

                  <div className="services-grid">
                    {visibleItems.map((service) => (
                      <ServiceCard
                        key={service.id}
                        service={service}
                        scrollDirection={scrollDirection}
                        onView={() => {
                          sessionStorage.setItem("servicesScrollY", window.scrollY.toString());
                          navigate(`/service/${service.slug || service.id}`, {
                            state: {
                              service,
                              allServices: services,
                              lastCategory: activeCategory
                            },
                          });
                        }}
                      />
                    ))}
                  </div>

                  {hasMore && (
                    <div className="view-all-btn-wrapper">
                      <button
                        className="view-all-services-btn"
                        onClick={() => toggleCategoryExpand(category)}
                      >
                        {isExpanded ? "Show Less" : "View All Services"}
                      </button>
                    </div>
                  )}
                </section>
              );
            })}

            {showGoUp && (
              <div className="services-go-up-wrapper">
                <button
                  className="services-go-up"
                  onClick={scrollToTop}
                  aria-label="Go to top"
                >
                  <FiArrowUp />
                </button>
              </div>
            )}
          </>
        )}
        </>
        )}
      </div>

      {!isDedicated && <FAQ />}

      {/* ✅ Hidden SEO Section (Background) */}
      <section style={{
        position: 'absolute',
        left: '-9999px',
        width: '1px',
        height: '1px',
        overflow: 'hidden'
      }}>
        <h2>Trusted Cleaning Services in Hyderabad</h2>
        <p>
          The Neatify Team provides professional home cleaning services in Hyderabad,
          including bathroom cleaning, kitchen cleaning and deep cleaning solutions.
          We proudly serve areas like Pragathi Nagar and Bachupally with reliable,
          affordable and high-quality cleaning services.
        </p>

        <h2>Why Choose Our Cleaning Experts?</h2>
        <p>
          Our trained professionals use safe cleaning products and modern equipment
          to deliver hygienic and spotless results. Whether you need bathroom cleaning
          or full home deep cleaning in Hyderabad, we ensure complete customer satisfaction.
        </p>

        <h2>Comprehensive Home Cleaning Solutions</h2>
        <p>
          We offer bathroom cleaning, kitchen cleaning, deep cleaning, move-in cleaning
          and commercial cleaning services across Hyderabad.
        </p>

        <h2>Frequently Asked Questions</h2>

        <h3>How much does home cleaning cost in Hyderabad?</h3>
        <p>
          The cost depends on the type of cleaning service and property size.
        </p>

        <h3>Do you provide cleaning services in Pragathi Nagar and Bachupally?</h3>
        <p>
          Yes, we provide professional cleaning services in Hyderabad.
        </p>
      </section>
    </div>
  );
}