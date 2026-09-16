/**
 * Utility to calculate the final display price for a service.
 * Priority: 
 * 1. Session-based "Claimed Offer" (specific to user session)
 * 2. Active Global Offer from 'offers' table (matching by title)
 * 3. Base Service data from 'services' table
 */
export const calculateServicePrice = (service, offersData = [], claimedOffer = null) => {
    if (!service) return null;

    // 1. Check for active global offers in Supabase
    const matchingOffer = (offersData || []).find(o => o.title === service.title);

    let finalPrice = service.price;
    let finalPct = parseFloat(service.discount_percent) || 0;
    let finalLabel = (service.discount_label ? service.discount_label.toUpperCase() : null) || (finalPct > 0 ? `${finalPct}% OFF` : null);

    if (matchingOffer) {
        const offerPct = parseFloat(matchingOffer.offer_percentage) || 0;

        finalPct = offerPct;
        finalLabel = offerPct > 0 ? `${offerPct}% OFF` : "SPECIAL OFFER";
    }

    return {
        price: finalPrice,
        discount_percent: finalPct,
        discount_label: finalLabel,
        isClaimed: false
    };
};
