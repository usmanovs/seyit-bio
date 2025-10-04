import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { CheckCircle2, Sparkles, Zap, Globe, Video } from 'lucide-react';

interface SubscriptionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const PRICE_ID = 'price_1SEVP4LJqhOyuCVB6Ufo2poQ';
const PRODUCT_ID = 'prod_TAr7eiELlowGAA';

export const SubscriptionModal = ({ open, onOpenChange }: SubscriptionModalProps) => {
  const { session } = useAuth();
  const [loading, setLoading] = useState(false);

  const handleSubscribe = async () => {
    if (!session) {
      toast.error('Please sign in to subscribe');
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-subscription-checkout', {
        body: { priceId: PRICE_ID },
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (error) throw error;

      if (data?.url) {
        window.open(data.url, '_blank');
      }
    } catch (error) {
      console.error('Error creating checkout:', error);
      toast.error('Failed to start checkout. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="text-3xl font-bold text-center">
            Unlock Full Access
          </DialogTitle>
          <DialogDescription className="text-center text-base">
            Start your 1-day free trial. No charge until tomorrow.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Pricing Card */}
          <div className="relative overflow-hidden rounded-2xl border-2 border-primary bg-gradient-to-br from-primary/5 to-secondary/5 p-6">
            <div className="absolute top-4 right-4">
              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-primary text-primary-foreground text-xs font-semibold">
                <Sparkles className="w-3 h-3" />
                POPULAR
              </span>
            </div>
            
            <div className="space-y-4">
              <div>
                <h3 className="text-2xl font-bold">Pro Plan</h3>
                <div className="flex items-baseline gap-2 mt-2">
                  <span className="text-4xl font-bold">$15</span>
                  <span className="text-muted-foreground">/month</span>
                </div>
              </div>

              <div className="space-y-3">
                {[
                  { icon: Video, text: 'Unlimited video processing' },
                  { icon: Globe, text: 'AI-powered Kyrgyz translations' },
                  { icon: Zap, text: 'Multiple caption styles' },
                  { icon: CheckCircle2, text: 'Priority support' },
                ].map((feature, index) => (
                  <div key={index} className="flex items-center gap-3">
                    <div className="flex-shrink-0 w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center">
                      <feature.icon className="w-3 h-3 text-primary" />
                    </div>
                    <span className="text-sm">{feature.text}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Trial Info */}
          <div className="rounded-xl bg-muted/50 p-4 space-y-2">
            <h4 className="font-semibold text-sm">24-Hour Free Trial</h4>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Try all features free for 24 hours. Cancel anytime before the trial ends and you won't be charged. 
              After the trial, you'll be billed $15/month.
            </p>
          </div>

          {/* CTA Button */}
          <Button
            onClick={handleSubscribe}
            disabled={loading}
            size="lg"
            className="w-full text-lg h-14 rounded-xl"
          >
            {loading ? 'Loading...' : 'Start 1-Day Free Trial'}
          </Button>

          <p className="text-xs text-center text-muted-foreground">
            By subscribing, you agree to our Terms of Service. Cancel anytime.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
};
