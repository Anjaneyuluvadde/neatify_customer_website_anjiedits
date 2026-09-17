import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../components/supabaseClient';

export default function usePromotionalBanners(user) {
  const [banners, setBanners] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchPromotionalBanners = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // 1. Fetch active banners
      const { data, error: fetchError } = await supabase
        .from("promotional_banners")
        .select("*")
        .eq("is_active", true)
        .eq("banner_type", "website")
        .order("display_order", { ascending: true });

      if (fetchError) {
        console.error("Promotional Banners error:", fetchError);
        setError(fetchError);
        return;
      }

      if (data && data.length > 0) {
        let completedBookingCount = 0;
        let customerPincode = null;
        let customerHubIds = [];
        const usedBannerIds = new Set();

        // 2. Fetch User specific info
        if (user && user.id) {
          // User Bookings
          const { data: bookings, error: bookingsError } = await supabase
            .from("bookings")
            .select("work_status, promotional_banner_id")
            .eq("user_id", user.id);

          if (!bookingsError && bookings) {
            bookings.forEach(booking => {
              const status = booking.work_status ? booking.work_status.toUpperCase() : "";
              if (status === "COMPLETED") {
                completedBookingCount++;
                if (booking.promotional_banner_id) {
                  usedBannerIds.add(booking.promotional_banner_id);
                }
              }
            });
          }

          // User Pincode
          const { data: userData, error: userError } = await supabase
            .from("users")
            .select("pincode")
            .eq("id", user.id)
            .single();

          if (!userError && userData && userData.pincode) {
            customerPincode = userData.pincode.trim();
          }
        }

        // 3. Resolve Customer Hub IDs (Location)
        if (customerPincode) {
          const { data: hubData } = await supabase
            .from("hub_locations")
            .select("id")
            .eq("pincode", customerPincode);

          if (hubData) {
            customerHubIds = hubData.map(h => h.id);
          }
        }

        // 4. Fetch Banner Scopes (Locations and Services)
        const { data: bannerLocations } = await supabase
          .from("promotional_banner_locations")
          .select("banner_id, location_id");

        const bannerLocMap = {};
        if (bannerLocations) {
          bannerLocations.forEach(bl => {
            if (!bannerLocMap[bl.banner_id]) {
              bannerLocMap[bl.banner_id] = [];
            }
            bannerLocMap[bl.banner_id].push(bl.location_id);
          });
        }

        const { data: bannerServices } = await supabase
          .from("promotional_banner_services")
          .select("banner_id, service_id");

        const bannerSvcMap = {};
        if (bannerServices) {
          bannerServices.forEach(bs => {
            if (!bannerSvcMap[bs.banner_id]) {
              bannerSvcMap[bs.banner_id] = [];
            }
            bannerSvcMap[bs.banner_id].push(bs.service_id);
          });
        }

        const now = new Date();

        // 5. Filter Eligible Banners
        const eligibleBanners = data.filter(banner => {
          // Attach service mapping for later use (e.g. click routing)
          banner.service_ids = bannerSvcMap[banner.id] || [];

          // Date Check
          if (banner.start_date && new Date(banner.start_date) > now) return false;
          if (banner.end_date && new Date(banner.end_date) < now) return false;

          // Banner Usage Check
          if (usedBannerIds.has(banner.id)) return false;

          // Customer Check
          let customerEligible = false;
          if (!banner.customer_type || banner.customer_type === "everyone") {
            customerEligible = true;
          } else if (banner.customer_type === "new" || banner.customer_type === "new_user") {
            customerEligible = completedBookingCount === 0;
          } else if (banner.customer_type === "existing" || banner.customer_type === "existing_user") {
            customerEligible = completedBookingCount > 0;
          }

          // Location Check
          let locationEligible = false;
          if (!banner.pincode_scope || banner.pincode_scope === "all") {
            locationEligible = true;
          } else if (banner.pincode_scope === "selected") {
            const allowedLocs = bannerLocMap[banner.id] || [];
            locationEligible = customerHubIds.some(hubId => allowedLocs.includes(hubId));
          }

          return customerEligible && locationEligible;
        });

        setBanners(eligibleBanners);
      } else {
        setBanners([]);
      }
    } catch (err) {
      console.error("Error evaluating banner eligibility:", err);
      setError(err);
      setBanners([]);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchPromotionalBanners();
  }, [fetchPromotionalBanners]);

  return { banners, loading, error, refetch: fetchPromotionalBanners };
}
