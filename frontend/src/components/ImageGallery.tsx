import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ChevronLeft, 
  ChevronRight, 
  X, 
  ZoomIn, 
  Download, 
  Share2,
  RotateCw,
  Maximize
} from 'lucide-react';

interface ImageGalleryProps {
  images: string[];
  carMake?: string;
  carModel?: string;
  carYear?: number;
}

function ImageGallery({ images, carMake, carModel, carYear }: ImageGalleryProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [loadedImages, setLoadedImages] = useState<Set<number>>(new Set());
  const [imageErrors, setImageErrors] = useState<Set<number>>(new Set());
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);

  // Preload images for better performance
  useEffect(() => {
    images.forEach((src, index) => {
      if (!loadedImages.has(index) && !imageErrors.has(index)) {
        const img = new Image();
        img.onload = () => {
          setLoadedImages(prev => new Set(prev).add(index));
        };
        img.onerror = () => {
          setImageErrors(prev => new Set(prev).add(index));
        };
        img.src = src;
      }
    });
  }, [images, loadedImages, imageErrors]);

  // Navigation functions
  const nextImage = useCallback(() => {
    setCurrentIndex((prev) => (prev + 1) % images.length);
    setZoom(1);
    setRotation(0);
  }, [images.length]);

  const prevImage = useCallback(() => {
    setCurrentIndex((prev) => (prev - 1 + images.length) % images.length);
    setZoom(1);
    setRotation(0);
  }, [images.length]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (isModalOpen) {
        switch (e.key) {
          case 'ArrowLeft':
            prevImage();
            break;
          case 'ArrowRight':
            nextImage();
            break;
          case 'Escape':
            setIsModalOpen(false);
            break;
          case '+':
          case '=':
            setZoom(prev => Math.min(prev * 1.2, 3));
            break;
          case '-':
            setZoom(prev => Math.max(prev / 1.2, 0.5));
            break;
          case 'r':
          case 'R':
            setRotation(prev => prev + 90);
            break;
        }
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [isModalOpen, nextImage, prevImage]);

  const openModal = (index: number) => {
    setCurrentIndex(index);
    setIsModalOpen(true);
    setZoom(1);
    setRotation(0);
    document.body.style.overflow = 'hidden';
  };

  const closeModal = () => {
    setIsModalOpen(false);
    document.body.style.overflow = 'unset';
  };

  const handleImageError = (index: number) => {
    setImageErrors(prev => new Set(prev).add(index));
  };

  const getImageSrc = (src: string, index: number) => {
    if (imageErrors.has(index)) {
      return 'https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?w=800&q=80&auto=format&fit=crop';
    }
    return src;
  };

  const handleDownload = async () => {
    try {
      setIsLoading(true);
      const response = await fetch(images[currentIndex]);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${carMake}-${carModel}-${carYear}-image-${currentIndex + 1}.jpg`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Download failed:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `${carYear} ${carMake} ${carModel}`,
          text: `Check out this ${carYear} ${carMake} ${carModel} at Royal Class Auctions!`,
          url: window.location.href,
        });
      } catch (error) {
        console.error('Share failed:', error);
      }
    } else {
      // Fallback - copy to clipboard
      navigator.clipboard.writeText(window.location.href);
      // You could show a toast here
    }
  };

  if (!images || images.length === 0) {
    return (
      <div className="bg-gray-200 rounded-2xl h-96 flex items-center justify-center">
        <div className="text-gray-500 text-center">
          <div className="text-4xl mb-2">🚗</div>
          <p>No images available</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="bg-white rounded-2xl overflow-hidden shadow-lg">
        {/* Main Image Display */}
        <div className="relative h-96 group cursor-pointer bg-gray-100">
          <AnimatePresence mode="wait">
            <motion.img
              key={`${currentIndex}-${imageErrors.size}`}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.3 }}
              src={getImageSrc(images[currentIndex], currentIndex)}
              alt={`${carYear} ${carMake} ${carModel} - Image ${currentIndex + 1}`}
              className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
              onClick={() => openModal(currentIndex)}
              onError={() => handleImageError(currentIndex)}
              loading="lazy"
            />
          </AnimatePresence>

          {/* Gradient Overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-black/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
          
          {/* Navigation Arrows */}
          {images.length > 1 && (
            <>
              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.95 }}
                onClick={(e) => { e.stopPropagation(); prevImage(); }}
                className="absolute left-4 top-1/2 transform -translate-y-1/2 w-12 h-12 bg-white/90 hover:bg-white text-gray-800 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300 shadow-lg hover:shadow-xl"
              >
                <ChevronLeft className="h-6 w-6" />
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.95 }}
                onClick={(e) => { e.stopPropagation(); nextImage(); }}
                className="absolute right-4 top-1/2 transform -translate-y-1/2 w-12 h-12 bg-white/90 hover:bg-white text-gray-800 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300 shadow-lg hover:shadow-xl"
              >
                <ChevronRight className="h-6 w-6" />
              </motion.button>
            </>
          )}

          {/* Top Controls */}
          <div className="absolute top-4 left-4 right-4 flex justify-between items-start opacity-0 group-hover:opacity-100 transition-opacity duration-300">
            <div className="bg-black/70 text-white px-3 py-1 rounded-lg text-sm font-medium">
              {currentIndex + 1} of {images.length}
            </div>
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => openModal(currentIndex)}
              className="bg-black/70 hover:bg-black/80 text-white p-2 rounded-lg transition-colors"
            >
              <Maximize className="h-4 w-4" />
            </motion.button>
          </div>

          {/* Loading Indicator */}
          {!loadedImages.has(currentIndex) && !imageErrors.has(currentIndex) && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full"
              />
            </div>
          )}
        </div>

        {/* Thumbnails */}
        {images.length > 1 && (
          <div className="p-4 bg-gray-50">
            <div className="flex space-x-2 overflow-x-auto scrollbar-hide">
              {images.map((image, index) => (
                <motion.button
                  key={index}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setCurrentIndex(index)}
                  className={`flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 transition-all duration-300 ${
                    index === currentIndex 
                      ? 'border-blue-500 shadow-lg ring-2 ring-blue-200' 
                      : 'border-gray-200 hover:border-gray-300 hover:shadow-md'
                  }`}
                >
                  <img
                    src={getImageSrc(image, index)}
                    alt={`Thumbnail ${index + 1}`}
                    className="w-full h-full object-cover"
                    onError={() => handleImageError(index)}
                    loading="lazy"
                  />
                  {!loadedImages.has(index) && (
                    <div className="absolute inset-0 bg-gray-200 animate-pulse" />
                  )}
                </motion.button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Full Screen Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/95 z-50 flex items-center justify-center"
            onClick={closeModal}
          >
            {/* Top Controls Bar */}
            <div className="absolute top-0 left-0 right-0 bg-gradient-to-b from-black/80 to-transparent p-6 z-10">
              <div className="flex items-center justify-between">
                <div className="text-white">
                  <h3 className="text-lg font-semibold">
                    {carYear} {carMake} {carModel}
                  </h3>
                  <p className="text-sm opacity-80">
                    Image {currentIndex + 1} of {images.length}
                  </p>
                </div>
                
                <div className="flex items-center space-x-2">
                  <motion.button
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={handleShare}
                    className="w-10 h-10 bg-white/10 hover:bg-white/20 text-white rounded-full flex items-center justify-center transition-colors"
                  >
                    <Share2 className="h-5 w-5" />
                  </motion.button>
                  
                  <motion.button
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={handleDownload}
                    disabled={isLoading}
                    className="w-10 h-10 bg-white/10 hover:bg-white/20 text-white rounded-full flex items-center justify-center transition-colors disabled:opacity-50"
                  >
                    {isLoading ? (
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                        className="w-4 h-4 border-2 border-white border-t-transparent rounded-full"
                      />
                    ) : (
                      <Download className="h-5 w-5" />
                    )}
                  </motion.button>

                  <motion.button
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={closeModal}
                    className="w-10 h-10 bg-white/10 hover:bg-white/20 text-white rounded-full flex items-center justify-center transition-colors"
                  >
                    <X className="h-5 w-5" />
                  </motion.button>
                </div>
              </div>
            </div>

            {/* Main Image */}
            <div className="relative max-w-[90vw] max-h-[80vh] flex items-center justify-center">
              <motion.img
                key={`modal-${currentIndex}`}
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ 
                  scale: zoom, 
                  opacity: 1,
                  rotate: rotation
                }}
                exit={{ scale: 0.8, opacity: 0 }}
                transition={{ type: "spring", stiffness: 300, damping: 25 }}
                src={getImageSrc(images[currentIndex], currentIndex)}
                alt={`${carYear} ${carMake} ${carModel} - Full size ${currentIndex + 1}`}
                className="max-w-full max-h-full object-contain cursor-grab active:cursor-grabbing select-none"
                onClick={(e) => e.stopPropagation()}
                draggable={false}
              />

              {/* Navigation Arrows */}
              {images.length > 1 && (
                <>
                  <motion.button
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={(e) => { e.stopPropagation(); prevImage(); }}
                    className="absolute left-4 top-1/2 transform -translate-y-1/2 w-14 h-14 bg-white/10 hover:bg-white/20 text-white rounded-full flex items-center justify-center transition-colors backdrop-blur-sm"
                  >
                    <ChevronLeft className="h-8 w-8" />
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={(e) => { e.stopPropagation(); nextImage(); }}
                    className="absolute right-4 top-1/2 transform -translate-y-1/2 w-14 h-14 bg-white/10 hover:bg-white/20 text-white rounded-full flex items-center justify-center transition-colors backdrop-blur-sm"
                  >
                    <ChevronRight className="h-8 w-8" />
                  </motion.button>
                </>
              )}
            </div>

            {/* Bottom Controls */}
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-6">
              <div className="flex items-center justify-center space-x-4">
                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setZoom(prev => Math.max(prev / 1.2, 0.5))}
                  className="w-10 h-10 bg-white/10 hover:bg-white/20 text-white rounded-full flex items-center justify-center transition-colors"
                  disabled={zoom <= 0.5}
                >
                  <span className="text-xl font-bold">−</span>
                </motion.button>
                
                <span className="text-white text-sm px-3 py-1 bg-white/10 rounded-full">
                  {Math.round(zoom * 100)}%
                </span>
                
                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setZoom(prev => Math.min(prev * 1.2, 3))}
                  className="w-10 h-10 bg-white/10 hover:bg-white/20 text-white rounded-full flex items-center justify-center transition-colors"
                  disabled={zoom >= 3}
                >
                  <span className="text-xl font-bold">+</span>
                </motion.button>

                <div className="w-px h-6 bg-white/20" />

                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setRotation(prev => prev + 90)}
                  className="w-10 h-10 bg-white/10 hover:bg-white/20 text-white rounded-full flex items-center justify-center transition-colors"
                >
                  <RotateCw className="h-5 w-5" />
                </motion.button>

                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => { setZoom(1); setRotation(0); }}
                  className="w-10 h-10 bg-white/10 hover:bg-white/20 text-white rounded-full flex items-center justify-center transition-colors"
                >
                  <ZoomIn className="h-5 w-5" />
                </motion.button>
              </div>

              {/* Thumbnail Strip */}
              {images.length > 1 && (
                <div className="flex justify-center mt-4 space-x-2 overflow-x-auto max-w-full">
                  {images.map((image, index) => (
                    <motion.button
                      key={index}
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => setCurrentIndex(index)}
                      className={`flex-shrink-0 w-12 h-12 rounded-lg overflow-hidden border-2 transition-all ${
                        index === currentIndex 
                          ? 'border-white shadow-lg' 
                          : 'border-white/30 hover:border-white/60'
                      }`}
                    >
                      <img
                        src={getImageSrc(image, index)}
                        alt={`Modal thumbnail ${index + 1}`}
                        className="w-full h-full object-cover"
                      />
                    </motion.button>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

export default ImageGallery;