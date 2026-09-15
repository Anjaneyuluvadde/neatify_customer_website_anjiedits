import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from './supabaseClient';
import { useToast } from './Toast/ToastContext';

export default function PromotionalBanners({ user }) {
  const [banners, setBanners] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const toast = useToast();

  const fetchPromotionalBanners = useCallback(async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("promotional_banners")
        .select("*")
        .eq("is_active", true)
        .order("display_order", { ascending: true });

      if (error) {
        console.error("Promotional Banners error:", error);
        return;
      }

      if (data) {
        let bookingCount = 0;
        if (user && user.id) {
          const { count, error: countError } = await supabase
            .from("bookings")
            .select("*", { count: "exact", head: true })
            .eq("user_id", user.id);

          if (!countError && count !== null) {
            bookingCount = count;
          }
        }

        const now = new Date();

        const eligibleBanners = data.filter(banner => {
          // 1. Date Check
          if (banner.start_date && new Date(banner.start_date) > now) return false;
          if (banner.end_date && new Date(banner.end_date) < now) return false;

          // 2. Customer Check
          let customerEligible = false;
          if (!banner.customer_type || banner.customer_type === "everyone") {
            customerEligible = true;
          } else if (banner.customer_type === "new" || banner.customer_type === "new_user") {
            customerEligible = bookingCount === 0;
          } else if (banner.customer_type === "existing" || banner.customer_type === "existing_user") {
            customerEligible = bookingCount > 0;
          }

          // 3. Location Check
          let locationEligible = false;
          if (!banner.pincode_scope || banner.pincode_scope === "all") {
            locationEligible = true;
          }

          return customerEligible && locationEligible;
        });

        setBanners(eligibleBanners);
      }
    } catch (err) {
      console.error("Error fetching banners:", err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchPromotionalBanners();
  }, [fetchPromotionalBanners]);

  const handleBannerClick = (banner) => {
    const claimType = (banner.customer_type === "new" || banner.customer_type === "new_user") 
      ? "NEW_USER" 
      : "PROMOTIONAL_BANNER";

    const claimObject = {
      type: claimType,
      bannerId: banner.id,
      offerPercentage: banner.offer_percentage,
      claimedAt: new Date().toISOString(),
    };

    sessionStorage.setItem("claimedOffer", JSON.stringify(claimObject));
    
    if (!user) {
      navigate("/signup");
    } else {
      toast.success(`Offer Applied! ${banner.offer_percentage}% discount is ready for your booking.`);
      // Optionally scroll to services section
      const servicesSection = document.getElementById("services-section");
      if (servicesSection) {
        servicesSection.scrollIntoView({ behavior: "smooth" });
      }
    }
  };

  if (loading || banners.length === 0) {
    return null;
  }

  return (
    <div className="promotional-banners-container">
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
  );
}
