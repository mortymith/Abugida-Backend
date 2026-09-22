/**
 * Barrel for Marketing & Growth server functions (spec 10). Client code
 * imports from here so wrapper modules (client-safe) stay decoupled from
 * impl modules (server-only, dynamically imported inside handlers).
 */

// S-8.1 Email Campaigns
export {
  cancelScheduledCampaign,
  createCampaign,
  duplicateCampaign,
  getComposerReference,
  getCampaign,
  getCampaigns,
  previewAudience,
  scheduleCampaign,
  sendCampaignNow,
  sendTestCampaign,
  updateCampaign,
} from './marketing.campaigns'

// S-8.2 Email Templates
export {
  createFromPrebuilt,
  getPrebuiltLibrary,
  getPreviewSample,
  getTemplate,
  listTemplates,
  saveTemplate,
  sendTestTemplate,
} from './marketing.templates'

// S-8.3 Discount & Coupon Codes
export {
  countRecentRedemptions,
  createCoupon,
  generateCouponBatch,
  getCouponRedemptions,
  listCoupons,
  updateCoupon,
} from './marketing.coupons'

// S-8.4 Affiliate Program
export {
  decideAffiliate,
  flagAffiliateFraud,
  generateAffiliateLink,
  getAffiliateProgram,
  getPendingPayouts,
  getPayoutHistory,
  inviteAffiliate,
  listAffiliates,
  runPayouts,
  saveProgramSettings,
  updateAffiliateStatus,
} from './marketing.affiliates'

// S-8.5 Student Testimonials
export {
  collectTestimonialManually,
  decideTestimonial,
  getTestimonialCourseOptions,
  getTestimonialSettings,
  listTestimonialRequests,
  listTestimonials,
  saveTestimonialSettings,
  setTestimonialFeatured,
} from './marketing.testimonials'
