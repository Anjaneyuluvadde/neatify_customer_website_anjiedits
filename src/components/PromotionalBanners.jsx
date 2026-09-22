import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToast } from './Toast/ToastContext';
import usePromotionalBanners from '../hooks/usePromotionalBanners';
import BannerServiceModal from './BannerServiceModal';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useGSAP } from '@gsap/react';
import { supabase } from './supabaseClient';

gsap.registerPlugin(ScrollTrigger);


export default function PromotionalBanners({ user }) {
  const { banners, activePromotionalBookings, loading } = usePromotionalBanners(user);
  const [activeBanner, setActiveBanner] = useState(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const navigate = useNavigate();
  const toast = useToast();
  
  const stageRef = useRef(null);
  const characterRef = useRef(null);
  const revealRef = useRef(null);
  const bannerContainerRef = useRef(null);

  const applyClaim = async (banner, serviceId = null, serviceTitle = null) => {
    const claimType = (banner.customer_type === "new" || banner.customer_type === "new_user") 
      ? "NEW_USER" 
      : "PROMOTIONAL_BANNER";

    const { data: { user: currentUser }, error: authError } = await supabase.auth.getUser();

    if (authError || !currentUser) {
      navigate("/signup");
      return;
    }

    if (serviceId && serviceTitle) {
      try {
        const { error } = await supabase
          .from("profile")
          .update({
            service_selected: serviceTitle,
            promotional_banner_selected: banner.id,
          })
          .eq("id", currentUser.id);

        if (error) {
          console.error("Failed to save promotional selection:", error);
          toast.error("Failed to save selection. Please try again.");
          return;
        }

        console.log("PROMO PROFILE UPDATE", {
          userId: currentUser.id,
          serviceSelected: serviceTitle,
          promotionalBannerSelected: banner.id,
        });

      } catch (err) {
        console.error("Error updating profile with promotional selection:", err);
        toast.error("Failed to save selection. Please try again.");
        return;
      }
    }

    const claimObject = {
      type: claimType,
      bannerId: banner.id,
      offerPercentage: banner.offer_percentage,
      claimedAt: new Date().toISOString(),
      serviceId: serviceId || null,
      serviceTitle: serviceTitle || null,
      userId: currentUser.id, // Bind session state to current user
    };

    sessionStorage.setItem("claimedOffer", JSON.stringify(claimObject));

    if (serviceId) {
      toast.success(`Offer Applied! ${banner.offer_percentage}% discount is ready for your booking.`);
      navigate(`/service/${serviceId}`);
    } else {
      toast.success(`Offer Applied! ${banner.offer_percentage}% discount is ready for your booking.`);
      const servicesSection = document.getElementById("services-section");
      if (servicesSection) {
        servicesSection.scrollIntoView({ behavior: "smooth" });
      }
    }
  };

  const handleBannerClick = async (banner) => {
    const { data: { user: currentUser } } = await supabase.auth.getUser();

    // 1. Check if there is an active promotional booking for this banner (STAGE 2 - DB)
    if (currentUser && activePromotionalBookings && activePromotionalBookings[banner.id]) {
      const activeBooking = activePromotionalBookings[banner.id];
      const serviceId = activeBooking.serviceIds?.[0];
      const serviceTitle = activeBooking.services?.[0]?.title || activeBooking.services?.[0]?.name || "the selected service";
      
      toast.info(`You have already selected ${serviceTitle} for the ${banner.offer_percentage}% discount.`);
      
      if (serviceId) {
        // Repopulate sessionStorage in case this is a new tab
        const claimObject = {
          type: "PROMOTIONAL_BANNER",
          bannerId: banner.id,
          offerPercentage: banner.offer_percentage,
          claimedAt: new Date().toISOString(),
          serviceId: serviceId,
          serviceTitle: serviceTitle,
          userId: currentUser.id,
        };
        sessionStorage.setItem("claimedOffer", JSON.stringify(claimObject));
        navigate(`/service/${serviceId}`);
      }
      return; // Do not open service selection modal
    }

    // 2. Read CURRENT user's profile to prevent stale state across users
    if (currentUser) {
      try {
        const { data: profile } = await supabase
          .from("profile")
          .select("service_selected, promotional_banner_selected")
          .eq("id", currentUser.id)
          .single();

        const hasSelectedThisBanner = profile?.promotional_banner_selected === banner.id;
        const hasSelectedService = Boolean(profile?.service_selected);

        if (hasSelectedThisBanner && hasSelectedService) {
          toast.info(`You have already selected ${profile.service_selected} for the ${banner.offer_percentage}% discount.`);

          // Try to recover the ID from sessionStorage to navigate
          try {
            const stored = sessionStorage.getItem("claimedOffer");
            if (stored) {
              const claimedOffer = JSON.parse(stored);
              if (claimedOffer.bannerId === banner.id && claimedOffer.userId === currentUser.id) {
                if (claimedOffer.serviceId) {
                  navigate(`/service/${claimedOffer.serviceId}`);
                }
              }
            }
          } catch (e) {}

          return; // Do not open service selection modal
        }
      } catch (err) {
        console.error("Error reading profile for promotional selection:", err);
      }
    }

    // 3. AVAILABLE state: Open selection modal or apply immediately
    if (banner.service_ids && banner.service_ids.length > 0) {
      setActiveBanner(banner);
    } else {
      applyClaim(banner);
    }
  };

  const handleServiceSelect = (service) => {
    setActiveBanner(null); // Close modal
    applyClaim(activeBanner, service.id, service.title);
  };

  useEffect(() => {
    if (banners.length <= 1) return;
    
    const interval = setInterval(() => {
      setCurrentIndex((prevIndex) => (prevIndex + 1) % banners.length);
    }, 4000); // Slide every 4 seconds
    
    return () => clearInterval(interval);
  }, [banners.length]);

  useGSAP(() => {
    if (loading || banners.length === 0 || !stageRef.current) return;

    const mm = gsap.matchMedia();

    mm.add({
      isDesktop: "(min-width: 1025px)",
      isTablet: "(min-width: 641px) and (max-width: 1024px)",
      isMobile: "(max-width: 640px)",
      reduceMotion: "(prefers-reduced-motion: reduce)"
    }, (context) => {
      let { isTablet, isMobile, reduceMotion } = context.conditions;

      if (reduceMotion) {
        gsap.set(revealRef.current, { clearProps: "all", clipPath: "inset(0 0% 0 0)" });
        gsap.set(characterRef.current, { display: "none" });
        return;
      }

      // 1. Initial State
      gsap.set(characterRef.current, { opacity: 0, x: 250, scale: 0.9 });
      gsap.set(revealRef.current, { clipPath: "inset(0 100% 0 0)" });
      gsap.set(bannerContainerRef.current, { scale: 0.97 });

      // Stage width calculation to wipe across the screen based on device
      const wipeDistance = isMobile ? -300 : isTablet ? -600 : -850;

      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: stageRef.current,
          start: "top 75%",
          end: "bottom 25%",
          scrub: 1,
        }
      });

      // 2. Character enters (0-15%)
      tl.to(characterRef.current, { opacity: 1, x: 0, scale: 1, duration: 0.15 })
        // 3. Wiping motion & Reveal Banner simultaneously (15-55%)
        .to(characterRef.current, { x: wipeDistance, duration: 0.4 }, "+=0")
        .to(revealRef.current, { clipPath: "inset(0 0% 0 0)", duration: 0.4 }, "<")
        // 4. Banner bounce (55-70%)
        .to(bannerContainerRef.current, { scale: 1, duration: 0.15, ease: "power1.out" })
        // 5. Settling and small idle float (70-80%)
        .to(characterRef.current, { y: -10, repeat: 1, yoyo: true, duration: 0.1 }, "<")
        // 6. Exit (80-100%)
        .to([characterRef.current, revealRef.current], { opacity: 0, y: -20, duration: 0.2 }, "+=0.1");
    });

    // Force ScrollTrigger to recalculate after layout shifts (e.g. from routing or fonts loading)
    const timeout = setTimeout(() => {
      ScrollTrigger.refresh();
    }, 500);

    return () => {
      clearTimeout(timeout);
      mm.revert();
    };
  }, { dependencies: [banners.length, loading], scope: stageRef });

  if (loading || banners.length === 0) {
    return null;
  }

  return (
    <>
      <div className="promotion-animation-section" ref={stageRef}>
        <div className="promotion-animation-stage">
          
          <div className="cleaning-character" ref={characterRef}>
            <img src="/assets/3dman.png" alt="Cleaning Character" className="cleaning-character-img" />
          </div>

          <div className="promotion-reveal" ref={revealRef}>
            <div className="promotional-slider-wrapper" ref={bannerContainerRef}>
              <div 
                className="promotional-banners-track"
                style={{ transform: `translateX(-${currentIndex * 100}%)` }}
              >
                {banners.map((banner) => (
                  <div 
                    key={banner.id} 
                    className="promotional-banner-item"
                    onClick={() => handleBannerClick(banner)}
                  >
                    <img 
                      src={banner.image_url} 
                      alt={banner.title || "Promotional Banner"} 
                      className="promotional-banner-image"
                      onError={(e) => { e.target.style.display = 'none'; }}
                    />
                  </div>
                ))}
              </div>

              {banners.length > 1 && (
                <div className="promotional-slider-dots">
                  {banners.map((_, idx) => (
                    <span 
                      key={idx} 
                      className={`slider-dot ${idx === currentIndex ? 'active' : ''}`}
                      onClick={() => setCurrentIndex(idx)}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {activeBanner && (
        <BannerServiceModal 
          banner={activeBanner}
          onClose={() => setActiveBanner(null)}
          onServiceSelect={handleServiceSelect}
        />
      )}
    </>
  );
}
