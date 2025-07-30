import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { extensionBridge, extensionInfo } from '@/utils/extensionApi';
import { Download, Chrome, Play, Users, Shield, Zap } from 'lucide-react';

interface ExtensionPromoProps {
  onExtensionDetected?: () => void;
}

export const ExtensionPromo: React.FC<ExtensionPromoProps> = ({ onExtensionDetected }) => {
  const [isExtensionInstalled, setIsExtensionInstalled] = useState(false);
  const [checkingExtension, setCheckingExtension] = useState(true);

  useEffect(() => {
    checkExtensionStatus();
    
    // Check every 3 seconds for extension installation
    const interval = setInterval(checkExtensionStatus, 3000);
    return () => clearInterval(interval);
  }, []);

  const checkExtensionStatus = async () => {
    try {
      const installed = await extensionBridge.isExtensionInstalled();
      setIsExtensionInstalled(installed);
      
      if (installed && onExtensionDetected) {
        onExtensionDetected();
      }
    } catch (error) {
      console.error('Failed to check extension status:', error);
    } finally {
      setCheckingExtension(false);
    }
  };

  const handleInstallExtension = () => {
    // In a real deployment, this would open the Chrome Web Store
    window.open('https://chrome.google.com/webstore', '_blank');
  };

  if (checkingExtension) {
    return (
      <Card className="w-full max-w-2xl mx-auto">
        <CardContent className="p-8 text-center">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-muted-foreground">Checking for UsTwo Extension...</p>
        </CardContent>
      </Card>
    );
  }

  if (isExtensionInstalled) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-2xl mx-auto"
      >
        <Card className="border-green-200 bg-green-50 dark:bg-green-950 dark:border-green-800">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-green-700 dark:text-green-300">
              <Chrome className="w-5 h-5" />
              Extension Installed!
            </CardTitle>
            <CardDescription className="text-green-600 dark:text-green-400">
              UsTwo Chrome Extension is ready for OTT sync across streaming platforms
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="text-center p-4 bg-white dark:bg-green-900 rounded-lg">
                <Users className="w-8 h-8 text-green-600 mx-auto mb-2" />
                <p className="font-medium text-sm">Join or Create Room</p>
                <p className="text-xs text-muted-foreground">Connect with your partner</p>
              </div>
              <div className="text-center p-4 bg-white dark:bg-green-900 rounded-lg">
                <Play className="w-8 h-8 text-green-600 mx-auto mb-2" />
                <p className="font-medium text-sm">Visit Streaming Site</p>
                <p className="text-xs text-muted-foreground">Netflix, Prime, YouTube, etc.</p>
              </div>
              <div className="text-center p-4 bg-white dark:bg-green-900 rounded-lg">
                <Zap className="w-8 h-8 text-green-600 mx-auto mb-2" />
                <p className="font-medium text-sm">Auto Sync</p>
                <p className="text-xs text-muted-foreground">Playback syncs instantly</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full max-w-4xl mx-auto"
    >
      <Card className="overflow-hidden">
        <CardHeader className="bg-gradient-to-r from-blue-600 to-purple-600 text-white">
          <CardTitle className="flex items-center gap-3 text-xl">
            <div className="p-2 bg-white/20 rounded-lg">
              <Chrome className="w-6 h-6" />
            </div>
            {extensionInfo.name}
          </CardTitle>
          <CardDescription className="text-blue-100">
            {extensionInfo.description}
          </CardDescription>
        </CardHeader>
        
        <CardContent className="p-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Features */}
            <div>
              <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
                <Zap className="w-5 h-5 text-primary" />
                Key Features
              </h3>
              <ul className="space-y-3">
                {extensionInfo.features.map((feature, index) => (
                  <li key={index} className="flex items-start gap-3">
                    <div className="w-2 h-2 bg-primary rounded-full mt-2 flex-shrink-0"></div>
                    <span className="text-sm">{feature}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Supported Platforms */}
            <div>
              <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
                <Play className="w-5 h-5 text-primary" />
                Supported Platforms
              </h3>
              <div className="flex flex-wrap gap-2">
                {extensionInfo.platforms.map((platform, index) => (
                  <Badge key={index} variant="secondary" className="text-xs">
                    {platform}
                  </Badge>
                ))}
              </div>

              <div className="mt-6">
                <h4 className="font-medium mb-3 flex items-center gap-2">
                  <Shield className="w-4 h-4 text-primary" />
                  Requirements
                </h4>
                <ul className="space-y-2">
                  {extensionInfo.requirements.map((req, index) => (
                    <li key={index} className="flex items-center gap-2 text-sm text-muted-foreground">
                      <div className="w-1.5 h-1.5 bg-muted-foreground rounded-full"></div>
                      {req}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>

          {/* How it Works */}
          <div className="mt-8 pt-8 border-t">
            <h3 className="font-semibold text-lg mb-6 text-center">How It Works</h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="text-center">
                <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-3">
                  <Download className="w-6 h-6 text-primary" />
                </div>
                <h4 className="font-medium text-sm mb-2">1. Install Extension</h4>
                <p className="text-xs text-muted-foreground">Add UsTwo to Chrome</p>
              </div>
              <div className="text-center">
                <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-3">
                  <Users className="w-6 h-6 text-primary" />
                </div>
                <h4 className="font-medium text-sm mb-2">2. Create Room</h4>
                <p className="text-xs text-muted-foreground">Share code with partner</p>
              </div>
              <div className="text-center">
                <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-3">
                  <Play className="w-6 h-6 text-primary" />
                </div>
                <h4 className="font-medium text-sm mb-2">3. Watch Together</h4>
                <p className="text-xs text-muted-foreground">Visit any supported platform</p>
              </div>
              <div className="text-center">
                <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-3">
                  <Zap className="w-6 h-6 text-primary" />
                </div>
                <h4 className="font-medium text-sm mb-2">4. Auto Sync</h4>
                <p className="text-xs text-muted-foreground">Playback syncs instantly</p>
              </div>
            </div>
          </div>

          {/* Install Button */}
          <div className="mt-8 text-center">
            <Button 
              onClick={handleInstallExtension}
              size="lg"
              className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
            >
              <Chrome className="w-5 h-5 mr-2" />
              Add to Chrome - It's Free
            </Button>
            <p className="text-xs text-muted-foreground mt-2">
              Extension will be available on Chrome Web Store soon
            </p>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
};