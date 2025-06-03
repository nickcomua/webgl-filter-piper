"use client"

import type React from "react"

import { useState, useRef, useCallback, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Slider } from "@/components/ui/slider"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Progress } from "@/components/ui/progress"
import { Separator } from "@/components/ui/separator"
import { Upload, Play, Square, Download, Trash2, Plus, Settings, Zap, Clock, Cpu, Monitor, ChevronLeft, ChevronRight, Images, Archive } from "lucide-react"
import { ReglSurface, type Filter, type FilterTemplate, type ProcessingResult, processImageWithPipeline } from "@/lib/gpu/ReglSurface"

interface ImageData {
  src: string
  name: string
  dimensions: { width: number; height: number }
  processedDataUrl?: string
}

interface PerformanceMetrics {
  gpuTime: number
  totalTime: number
  memoryUsage: number
  throughput: number
  imagesProcessed: number
  averageTimePerImage: number
}

export default function GPUImageProcessingUI() {
  const [images, setImages] = useState<ImageData[]>([])
  const [currentImageIndex, setCurrentImageIndex] = useState(0)
  const [pipeline, setPipeline] = useState<Filter[]>([])
  const [performanceMetrics, setPerformanceMetrics] = useState<PerformanceMetrics>({
    gpuTime: 0,
    totalTime: 0,
    memoryUsage: 0,
    throughput: 0,
    imagesProcessed: 0,
    averageTimePerImage: 0
  })
  const [isProcessing, setIsProcessing] = useState(false)
  const [processingProgress, setProcessingProgress] = useState(0)
  const [currentProcessingImage, setCurrentProcessingImage] = useState("")
  const [isExporting, setIsExporting] = useState(false)
  const [exportProgress, setExportProgress] = useState(0)
  const [currentExportingImage, setCurrentExportingImage] = useState("")
  const fileInputRef = useRef<HTMLInputElement>(null)
  const thumbnailScrollRef = useRef<HTMLDivElement>(null)
  const [recentlyAdded, setRecentlyAdded] = useState<string>("")

  const availableFilters: FilterTemplate[] = [
    { 
      id: "debug", 
      name: "🔴 Debug Red Tint", 
      type: "debug", 
      defaultParams: {},
      paramConfig: {}
    },
    {
      id: "blur",
      name: "Gaussian Blur",
      type: "convolution",
      defaultParams: { radius: 1.0 },
      paramConfig: {
        radius: { min: 0.5, max: 5, step: 0.1 }
      }
    },
    {
      id: "sharpen",
      name: "Sharpen",
      type: "convolution",
      defaultParams: { strength: 1.0 },
      paramConfig: {
        strength: { min: 0, max: 3, step: 0.1 }
      }
    },
    {
      id: "edge",
      name: "Edge Detection",
      type: "convolution",
      defaultParams: { threshold: 0.5 },
      paramConfig: {
        threshold: { min: 0.1, max: 2, step: 0.1 }
      }
    },
    {
      id: "brightness",
      name: "Brightness",
      type: "color",
      defaultParams: { value: 0.0 },
      paramConfig: {
        value: { min: -50, max: 50, step: 1 }
      }
    },
    {
      id: "contrast",
      name: "Contrast",
      type: "color",
      defaultParams: { value: 1.0 },
      paramConfig: {
        value: { min: 0.1, max: 3, step: 0.1 }
      }
    },
    {
      id: "saturation",
      name: "Saturation",
      type: "color",
      defaultParams: { value: 1.0 },
      paramConfig: {
        value: { min: 0, max: 3, step: 0.1 }
      }
    },
    {
      id: "noise",
      name: "Noise Reduction",
      type: "advanced",
      defaultParams: { strength: 0.5 },
      paramConfig: {
        strength: { min: 0, max: 1, step: 0.1 }
      }
    },
    {
      id: "bilateral",
      name: "Bilateral Filter",
      type: "advanced",
      defaultParams: { spatial: 1.0, color: 0.1 },
      paramConfig: {
        spatial: { min: 0.5, max: 3, step: 0.1 },
        color: { min: 0.01, max: 1, step: 0.01 }
      }
    },
  ];

  // Auto-scroll thumbnail carousel to current image
  useEffect(() => {
    if (thumbnailScrollRef.current && images.length > 1) {
      const container = thumbnailScrollRef.current
      
      const thumbnailWidth = 64 + 8 // 64px width + 8px margin
      const scrollPosition = currentImageIndex * thumbnailWidth - (container.clientWidth / 2) + (thumbnailWidth / 2)
      
      container.scrollTo({
        left: Math.max(0, scrollPosition),
        behavior: 'smooth'
      })
    }
  }, [currentImageIndex])

  const handleImageUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files
    if (files && files.length > 0) {
      const imagePromises = Array.from(files).map((file, index) => {
        return new Promise<ImageData>((resolve) => {
          const reader = new FileReader()
          reader.onload = (e) => {
            const img = new window.Image()
            img.onload = () => {
              resolve({
                src: e.target?.result as string,
                name: file.name,
                dimensions: { width: img.naturalWidth, height: img.naturalHeight }
              })
            }
            img.src = e.target?.result as string
          }
          reader.readAsDataURL(file)
        })
      })

      Promise.all(imagePromises).then((loadedImages) => {
        setImages(loadedImages)
        setCurrentImageIndex(0)
        setPerformanceMetrics({
          gpuTime: 0,
          totalTime: 0,
          memoryUsage: 0,
          throughput: 0,
          imagesProcessed: 0,
          averageTimePerImage: 0
        })
      })
    }
  }, [])

  const updateMetricsRealTime = useCallback((
    completedImages: number, 
    totalImages: number, 
    accumulatedGpuTime: number, 
    accumulatedTotalTime: number, 
    maxMemoryUsage: number
  ) => {
    const averageTimePerImage = completedImages > 0 ? accumulatedTotalTime / completedImages : 0
    
    // Calculate throughput based on completed images
    const totalDataSize = images.slice(0, completedImages).reduce((sum, img) => {
      const pixels = img.dimensions.width * img.dimensions.height
      return sum + (pixels * 4) / (1024 * 1024) // RGBA bytes to MB
    }, 0)
    const throughput = accumulatedTotalTime > 0 ? totalDataSize / (accumulatedTotalTime / 1000) : 0

    setPerformanceMetrics({
      gpuTime: accumulatedGpuTime,
      totalTime: accumulatedTotalTime,
      memoryUsage: maxMemoryUsage,
      throughput: throughput,
      imagesProcessed: completedImages,
      averageTimePerImage: averageTimePerImage
    })
  }, [images])

  const processAllImages = useCallback(async () => {
    if (images.length === 0 || pipeline.filter(f => f.enabled).length === 0) return

    setIsProcessing(true)
    setProcessingProgress(0)

    const batchStartTime = performance.now()
    let accumulatedGpuTime = 0
    let accumulatedTotalTime = 0
    let maxMemoryUsage = 0
    const processedImages = [...images]

    try {
      for (let i = 0; i < images.length; i++) {
        const image = images[i]
        setCurrentProcessingImage(image.name)
        setCurrentImageIndex(i) // Auto-scroll carousel
        setProcessingProgress((i / images.length) * 100)

        // Get fitted dimensions for processing
        const { width: processWidth, height: processHeight } = getFittedSize(
          image.dimensions.width, 
          image.dimensions.height, 
          1920, 
          1080
        )

        console.log(`🎨 Processing ${image.name} at ${processWidth}x${processHeight}...`)

        const imageStartTime = performance.now()
        const result = await processImageWithPipeline(
          image.src,
          pipeline,
          processWidth,
          processHeight
        )

        if (result.success) {
          const imageEndTime = performance.now()
          const imageTotalTime = imageEndTime - imageStartTime
          
          accumulatedGpuTime += result.gpuTime
          accumulatedTotalTime += imageTotalTime
          maxMemoryUsage = Math.max(maxMemoryUsage, result.memoryUsage)
          processedImages[i] = { ...image, processedDataUrl: result.imageDataUrl }
          
          // Update metrics in real-time
          updateMetricsRealTime(i + 1, images.length, accumulatedGpuTime, accumulatedTotalTime, maxMemoryUsage)
          
          console.log(`✅ ${image.name}: ${imageTotalTime.toFixed(2)}ms (GPU: ${result.gpuTime.toFixed(2)}ms)`)
        } else {
          console.error(`❌ Failed to process ${image.name}:`, result.error)
          // Still update metrics for failed images
          const imageEndTime = performance.now()
          const imageTotalTime = imageEndTime - imageStartTime
          accumulatedTotalTime += imageTotalTime
          updateMetricsRealTime(i + 1, images.length, accumulatedGpuTime, accumulatedTotalTime, maxMemoryUsage)
        }

        // Small delay to allow UI updates and smooth scrolling
        await new Promise(resolve => setTimeout(resolve, 100))
      }

      // Update images with processed results
      setImages(processedImages)
      setProcessingProgress(100)

      console.log(`🎉 Batch processing completed!`)

    } catch (error) {
      console.error('Error during batch processing:', error)
    } finally {
      setIsProcessing(false)
      setCurrentProcessingImage("")
      setTimeout(() => setProcessingProgress(0), 2000)
    }
  }, [images, pipeline, updateMetricsRealTime])

  const batchExport = useCallback(async () => {
    if (images.length === 0) return

    setIsExporting(true)
    setExportProgress(0)

    const enabledFilters = pipeline.filter(f => f.enabled)
    
    try {
      if (enabledFilters.length === 0) {
        // Export original images
        for (let i = 0; i < images.length; i++) {
          const image = images[i]
          setCurrentExportingImage(image.name)
          setCurrentImageIndex(i)
          setExportProgress((i / images.length) * 100)

          const link = document.createElement('a')
          link.href = image.src
          link.download = `original_${image.name}`
          document.body.appendChild(link)
          link.click()
          document.body.removeChild(link)

          // Delay between downloads
          await new Promise(resolve => setTimeout(resolve, 200))
        }
      } else {
        // Export processed images
        for (let i = 0; i < images.length; i++) {
          const image = images[i]
          setCurrentExportingImage(image.name)
          setCurrentImageIndex(i) // Auto-scroll carousel during export
          setExportProgress((i / images.length) * 100)

          let dataUrl = image.processedDataUrl

          // If not already processed, process it now
          if (!dataUrl) {
            const { width, height } = getFittedSize(
              image.dimensions.width, 
              image.dimensions.height, 
              1920, 
              1080
            )

            console.log(`🔄 Processing ${image.name} for export...`)
            const result = await processImageWithPipeline(image.src, pipeline, width, height)
            if (result.success && result.imageDataUrl) {
              dataUrl = result.imageDataUrl
              // Update the image with processed result
              setImages(prev => prev.map((img, idx) => 
                idx === i ? { ...img, processedDataUrl: dataUrl } : img
              ))
            } else {
              console.error(`Failed to process ${image.name} for export`)
              continue
            }
          }

          if (dataUrl) {
            const link = document.createElement('a')
            link.href = dataUrl
            const baseName = image.name.replace(/\.[^/.]+$/, "") // Remove extension
            const filterNames = enabledFilters.map(f => f.id.split('-')[0]).join('_')
            link.download = `${baseName}_processed_${filterNames}.png`
            document.body.appendChild(link)
            link.click()
            document.body.removeChild(link)

            console.log(`💾 Exported: ${link.download}`)
          }
        }
      }

      setExportProgress(100)
      console.log(`📦 Batch export completed: ${images.length} images`)

    } catch (error) {
      console.error('Error during batch export:', error)
    } finally {
      setIsExporting(false)
      setCurrentExportingImage("")
      setTimeout(() => setExportProgress(0), 2000)
    }
  }, [images, pipeline])

  const addFilterToPipeline = useCallback((filterId: string) => {
    const filterTemplate = availableFilters.find((f) => f.id === filterId)
    if (filterTemplate) {
      const newFilter: Filter = {
        id: `${filterId}-${Date.now()}`,
        name: filterTemplate.name,
        type: filterTemplate.type,
        parameters: { ...filterTemplate.defaultParams },
        enabled: true,
        paramConfig: filterTemplate.paramConfig,
      }
      setPipeline((prev) => [...prev, newFilter])

      setRecentlyAdded(filterId)
      setTimeout(() => setRecentlyAdded(""), 600)
    }
  }, [])

  const removeFilterFromPipeline = useCallback((filterId: string) => {
    setPipeline((prev) => prev.filter((f) => f.id !== filterId))
  }, [])

  const updateFilterParameter = useCallback((filterId: string, paramName: string, value: number) => {
    setPipeline((prev) =>
      prev.map((filter) =>
        filter.id === filterId ? { ...filter, parameters: { ...filter.parameters, [paramName]: value } } : filter,
      ),
    )
  }, [])

  const toggleFilter = useCallback((filterId: string) => {
    setPipeline((prev) =>
      prev.map((filter) => (filter.id === filterId ? { ...filter, enabled: !filter.enabled } : filter)),
    )
  }, [])

  const navigateCarousel = useCallback((direction: 'prev' | 'next') => {
    setCurrentImageIndex((prevIndex) => {
      if (direction === 'prev') {
        return prevIndex > 0 ? prevIndex - 1 : images.length - 1
      } else {
        return prevIndex < images.length - 1 ? prevIndex + 1 : 0
      }
    })
  }, [images.length])

  const selectImageAtIndex = useCallback((index: number) => {
    setCurrentImageIndex(index)
  }, [])

  function getFittedSize(width: number, height: number, maxWidth: number, maxHeight: number) {
    const ratio = Math.min(maxWidth / width, maxHeight / height)
    return {
      width: Math.round(width * ratio),
      height: Math.round(height * ratio),
    }
  }

  const currentImage = images[currentImageIndex]

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-4">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <Card className="border-2 border-blue-200 bg-gradient-to-r from-blue-50 to-indigo-50">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-2xl font-bold text-blue-900">
                  GPU-Pipelined Image Processing System
                </CardTitle>
                <p className="text-blue-700 mt-2">
                  Bachelor's Thesis - Computer Engineering | Cross-platform GPU Computing via OpenGL/GLSL
                </p>
              </div>
              <div className="flex items-center space-x-2">
                <Badge variant="secondary" className="bg-green-100 text-green-800">
                  <Monitor className="w-3 h-3 mr-1" />
                  OpenGL Ready
                </Badge>
                <Badge variant="secondary" className="bg-blue-100 text-blue-800">
                  <Zap className="w-3 h-3 mr-1" />
                  Real-time Metrics
                </Badge>
                {images.length > 0 && (
                  <Badge variant="secondary" className="bg-purple-100 text-purple-800">
                    <Images className="w-3 h-3 mr-1" />
                    {images.length} Image{images.length > 1 ? 's' : ''}
                  </Badge>
                )}
              </div>
            </div>
          </CardHeader>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Image Display and Upload */}
          <div className="lg:col-span-2 space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Upload className="w-5 h-5 mr-2" />
                  Image Input/Output
                  {images.length > 1 && (
                    <Badge variant="outline" className="ml-2">
                      {currentImageIndex + 1} of {images.length}
                    </Badge>
                  )}
                  {isProcessing && currentProcessingImage && (
                    <Badge variant="outline" className="ml-2 bg-blue-50 text-blue-700 animate-pulse">
                      Processing: {currentProcessingImage}
                    </Badge>
                  )}
                  {isExporting && currentExportingImage && (
                    <Badge variant="outline" className="ml-2 bg-green-50 text-green-700 animate-pulse">
                      Exporting: {currentExportingImage}
                    </Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex space-x-2 flex-wrap gap-2">
                    <Button
                      onClick={() => fileInputRef.current?.click()}
                      variant="outline"
                      className="flex items-center"
                      disabled={isProcessing || isExporting}
                    >
                      <Upload className="w-4 h-4 mr-2" />
                      Load Images
                    </Button>
                    <Button
                      onClick={processAllImages}
                      disabled={!currentImage || pipeline.filter(f => f.enabled).length === 0 || isProcessing || isExporting}
                      className="flex items-center"
                    >
                      {isProcessing ? (
                        <>
                          <div className="w-4 h-4 mr-2 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          Processing...
                        </>
                      ) : (
                        <>
                          <Play className="w-4 h-4 mr-2" />
                          Process Pipeline
                        </>
                      )}
                    </Button>
                    <Button 
                      variant="outline" 
                      disabled={!currentImage || isProcessing || isExporting} 
                      className="flex items-center"
                      onClick={() => {
                        if (currentImage?.processedDataUrl || pipeline.filter(f => f.enabled).length === 0) {
                          const link = document.createElement('a')
                          link.href = currentImage.processedDataUrl || currentImage.src
                          link.download = `processed_${currentImage.name}`
                          document.body.appendChild(link)
                          link.click()
                          document.body.removeChild(link)
                        }
                      }}
                    >
                      <Download className="w-4 h-4 mr-2" />
                      Save Current
                    </Button>
                    {images.length > 1 && (
                      <Button 
                        variant="outline" 
                        className="flex items-center"
                        onClick={batchExport}
                        disabled={isProcessing || isExporting}
                      >
                        {isExporting ? (
                          <>
                            <div className="w-4 h-4 mr-2 border-2 border-current border-t-transparent rounded-full animate-spin" />
                            Exporting...
                          </>
                        ) : (
                          <>
                            <Archive className="w-4 h-4 mr-2" />
                            Batch Export
                          </>
                        )}
                      </Button>
                    )}
                  </div>

                  {/* Processing Progress */}
                  {isProcessing && (
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>Processing images... ({Math.round(processingProgress)}%)</span>
                        <span>{currentProcessingImage}</span>
                      </div>
                      <Progress value={processingProgress} className="w-full" />
                    </div>
                  )}

                  {/* Export Progress */}
                  {isExporting && (
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>Exporting images... ({Math.round(exportProgress)}%)</span>
                        <span>{currentExportingImage}</span>
                      </div>
                      <Progress value={exportProgress} className="w-full bg-green-100">
                        <div 
                          className="h-full bg-green-500 transition-all duration-300 ease-out"
                          style={{ width: `${exportProgress}%` }}
                        />
                      </Progress>
                    </div>
                  )}

                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handleImageUpload}
                    className="hidden"
                  />

                  <div className="border-2 border-dashed border-gray-300 rounded-lg overflow-hidden">
                    {currentImage ? (
                      <div className="relative">
                        {/* Main Image Display - FIXED HEIGHT */}
                        <div className="h-[500px] p-8 flex items-center justify-center bg-white">
                          <ReglSurface
                            image={currentImage.src}
                            pipeline={pipeline}
                            {...getFittedSize(
                              currentImage.dimensions.width,
                              currentImage.dimensions.height,
                              600,
                              400
                            )}
                          />
                        </div>

                        {/* Image Info Overlay */}
                        <div className="absolute top-4 left-4 bg-black/75 text-white px-3 py-1 rounded-lg text-sm">
                          {currentImage.name} | {currentImage.dimensions.width}×{currentImage.dimensions.height}
                          {currentImage.processedDataUrl && (
                            <span className="ml-2 text-green-300">✓ Processed</span>
                          )}
                          {isProcessing && currentProcessingImage === currentImage.name && (
                            <span className="ml-2 text-blue-300 animate-pulse">⚡ Processing...</span>
                          )}
                          {isExporting && currentExportingImage === currentImage.name && (
                            <span className="ml-2 text-green-300 animate-pulse">📦 Exporting...</span>
                          )}
                        </div>

                        {/* Navigation Controls for Multiple Images */}
                        {images.length > 1 && (
                          <>
                            <Button
                              variant="secondary"
                              size="sm"
                              className="absolute left-4 top-1/2 transform -translate-y-1/2 bg-black/75 hover:bg-black/90 text-white border-none"
                              onClick={() => navigateCarousel('prev')}
                              disabled={isProcessing || isExporting}
                            >
                              <ChevronLeft className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="secondary"
                              size="sm"
                              className="absolute right-4 top-1/2 transform -translate-y-1/2 bg-black/75 hover:bg-black/90 text-white border-none"
                              onClick={() => navigateCarousel('next')}
                              disabled={isProcessing || isExporting}
                            >
                              <ChevronRight className="w-4 h-4" />
                            </Button>
                          </>
                        )}
                      </div>
                    ) : (
                      <div className="h-[500px] p-8 flex items-center justify-center text-gray-500 bg-white">
                        <div>
                          <Upload className="w-12 h-12 mx-auto mb-4 opacity-50" />
                          <p>Click "Load Images" or drag and drop images here</p>
                          <p className="text-sm mt-2">Supports multiple files: JPG, PNG, BMP, TIFF</p>
                        </div>
                      </div>
                    )}

                    {/* Thumbnail Carousel with Auto-scroll */}
                    {images.length > 1 && (
                      <div className="bg-gray-100 p-4 border-t">
                        <div 
                          ref={thumbnailScrollRef}
                          className="flex space-x-2 overflow-x-auto pb-2 scroll-smooth"
                          style={{ scrollbarWidth: 'thin' }}
                        >
                          {images.map((image, index) => (
                            <div
                              key={index}
                              className={`
                                flex-shrink-0 relative cursor-pointer transition-all duration-200
                                ${index === currentImageIndex 
                                  ? 'ring-2 ring-blue-500 scale-105' 
                                  : 'hover:ring-2 hover:ring-gray-400 hover:scale-102'
                                }
                              `}
                              onClick={() => !isProcessing && !isExporting && selectImageAtIndex(index)}
                            >
                              <img
                                src={image.src}
                                alt={image.name}
                                className="w-16 h-16 object-cover rounded-lg"
                              />
                              <div className="absolute -top-2 -right-2 bg-blue-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                                {index + 1}
                              </div>
                              {image.processedDataUrl && (
                                <div className="absolute -bottom-1 -right-1 bg-green-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center">
                                  ✓
                                </div>
                              )}
                              {isProcessing && currentProcessingImage === image.name && (
                                <div className="absolute inset-0 bg-blue-500/40 rounded-lg flex items-center justify-center">
                                  <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                </div>
                              )}
                              {isExporting && currentExportingImage === image.name && (
                                <div className="absolute inset-0 bg-green-500/40 rounded-lg flex items-center justify-center">
                                  <div className="text-white text-xs">📦</div>
                                </div>
                              )}
                              {index === currentImageIndex && (
                                <div className="absolute inset-0 bg-blue-500/20 rounded-lg" />
                              )}
                            </div>
                          ))}
                        </div>
                        <div className="text-xs text-gray-600 mt-2 text-center">
                          Auto-scrolls during processing • Green checkmark = Processed
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Real-time Performance Metrics */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center">
                        <Clock className="w-5 h-5 mr-2" />
                        Real-time Performance Metrics
                        {performanceMetrics.imagesProcessed > 0 && (
                          <Badge variant="outline" className="ml-2 bg-green-50 text-green-700">
                            {performanceMetrics.imagesProcessed} / {images.length} processed
                          </Badge>
                        )}
                        {isProcessing && (
                          <Badge variant="outline" className="ml-2 bg-blue-50 text-blue-700 animate-pulse">
                            Live Updates
                          </Badge>
                        )}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="text-center p-3 bg-blue-50 rounded-lg">
                          <div className="text-2xl font-bold text-blue-600">
                            {performanceMetrics.gpuTime.toFixed(0)}ms
                          </div>
                          <div className="text-sm text-blue-800">GPU Time</div>
                          {isProcessing && (
                            <div className="text-xs text-blue-600 animate-pulse">Updating...</div>
                          )}
                        </div>
                        <div className="text-center p-3 bg-green-50 rounded-lg">
                          <div className="text-2xl font-bold text-green-600">
                            {performanceMetrics.totalTime.toFixed(0)}ms
                          </div>
                          <div className="text-sm text-green-800">Total Time</div>
                          {isProcessing && (
                            <div className="text-xs text-green-600 animate-pulse">Live</div>
                          )}
                        </div>
                        <div className="text-center p-3 bg-purple-50 rounded-lg">
                          <div className="text-2xl font-bold text-purple-600">
                            {performanceMetrics.memoryUsage.toFixed(1)}MB
                          </div>
                          <div className="text-sm text-purple-800">Peak VRAM</div>
                        </div>
                        <div className="text-center p-3 bg-orange-50 rounded-lg">
                          <div className="text-2xl font-bold text-orange-600">
                            {performanceMetrics.throughput.toFixed(1)}MB/s
                          </div>
                          <div className="text-sm text-orange-800">Throughput</div>
                          {isProcessing && (
                            <div className="text-xs text-orange-600 animate-pulse">Real-time</div>
                          )}
                        </div>
                      </div>
                      {performanceMetrics.imagesProcessed > 1 && (
                        <div className="mt-4 text-center p-3 bg-gray-50 rounded-lg">
                          <div className="text-lg font-bold text-gray-700">
                            {performanceMetrics.averageTimePerImage.toFixed(1)}ms
                          </div>
                          <div className="text-sm text-gray-600">Average per Image</div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Filter Controls - Rest remains the same */}
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Settings className="w-5 h-5 mr-2" />
                  Filter Pipeline
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Tabs defaultValue="pipeline" className="w-full">
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="pipeline">Pipeline</TabsTrigger>
                    <TabsTrigger value="library">Library</TabsTrigger>
                  </TabsList>

                  <TabsContent value="pipeline" className="space-y-3">
                    {pipeline.length === 0 ? (
                      <div className="text-center text-gray-500 py-8">
                        <Settings className="w-8 h-8 mx-auto mb-2 opacity-50" />
                        <p>No filters in pipeline</p>
                        <p className="text-sm">Add filters from the Library tab</p>
                      </div>
                    ) : (
                      pipeline.map((filter, index) => (
                        <Card
                          key={filter.id}
                          className={`${filter.enabled ? "border-blue-200" : "border-gray-200 opacity-60"}`}
                        >
                          <CardContent className="p-3">
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center space-x-2">
                                <span className="text-xs bg-gray-100 px-2 py-1 rounded">{index + 1}</span>
                                <span className="font-medium text-sm">{filter.name}</span>
                              </div>
                              <div className="flex items-center space-x-1">
                                <Button
                                  size="sm"
                                  variant={filter.enabled ? "default" : "outline"}
                                  onClick={() => toggleFilter(filter.id)}
                                  className="h-6 px-2"
                                  disabled={isProcessing || isExporting}
                                >
                                  {filter.enabled ? "ON" : "OFF"}
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => removeFilterFromPipeline(filter.id)}
                                  className="h-6 w-6 p-0"
                                  disabled={isProcessing || isExporting}
                                >
                                  <Trash2 className="w-3 h-3" />
                                </Button>
                              </div>
                            </div>
                            {filter.enabled && (
                              <div className="space-y-2">
                                {Object.entries(filter.parameters).map(([param, value]) => {
                                  const config = filter.paramConfig?.[param] || { min: 0, max: 10, step: 0.1 };
                                  return (
                                    <div key={param} className="space-y-1">
                                      <div className="flex justify-between text-xs">
                                        <span className="capitalize">{param}</span>
                                        <span>{typeof value === 'number' ? value.toFixed(config.step < 1 ? 2 : 0) : value}</span>
                                      </div>
                                      <Slider
                                        value={[value]}
                                        onValueChange={(newValue) => updateFilterParameter(filter.id, param, newValue[0])}
                                        max={config.max}
                                        min={config.min}
                                        step={config.step}
                                        className="w-full"
                                        disabled={isProcessing || isExporting}
                                      />
                                    </div>
                                  )
                                })}
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      ))
                    )}
                  </TabsContent>

                  <TabsContent value="library" className="space-y-2">
                    {availableFilters.map((filter) => (
                      <Card
                        key={filter.id}
                        className={`cursor-pointer hover:bg-gray-50 transition-all duration-300 ${recentlyAdded === filter.id
                          ? "scale-95 bg-green-50 border-green-200 shadow-lg"
                          : "hover:shadow-md"
                          } ${isProcessing || isExporting ? "opacity-50 cursor-not-allowed" : ""}`}
                      >
                        <CardContent className="p-3">
                          <div className="flex items-center justify-between">
                            <div>
                              <div className="font-medium text-sm">{filter.name}</div>
                              <div className="text-xs text-gray-500 capitalize">{filter.type}</div>
                            </div>
                            <Button
                              size="sm"
                              onClick={() => addFilterToPipeline(filter.id)}
                              className={`h-6 w-6 p-0 transition-all duration-200 ${recentlyAdded === filter.id ? "bg-green-500 hover:bg-green-600 scale-110" : ""
                                }`}
                              disabled={isProcessing || isExporting}
                            >
                              <Plus
                                className={`w-3 h-3 transition-transform duration-200 ${recentlyAdded === filter.id ? "rotate-90" : ""
                                  }`}
                              />
                            </Button>
                          </div>
                          {recentlyAdded === filter.id && (
                            <div className="mt-2 text-xs text-green-600 font-medium animate-pulse">
                              Added to pipeline!
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>

            {/* System Info */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Cpu className="w-5 h-5 mr-2" />
                  System Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>Graphics API:</span>
                  <Badge variant="outline">WebGL 2.0</Badge>
                </div>
                <div className="flex justify-between">
                  <span>Real-time Metrics:</span>
                  <Badge variant="outline" className="bg-green-50 text-green-700">
                    {isProcessing ? "Live" : "Ready"}
                  </Badge>
                </div>
                <div className="flex justify-between">
                  <span>Auto-scroll Carousel:</span>
                  <Badge variant="outline" className="bg-blue-50 text-blue-700">
                    Enabled
                  </Badge>
                </div>
                <div className="flex justify-between">
                  <span>Batch Operations:</span>
                  <Badge variant="outline" className="bg-purple-50 text-purple-700">
                    Process & Export
                  </Badge>
                </div>
                <Separator className="my-2" />
                <div className="text-xs text-gray-500">
                  Live performance monitoring with auto-scrolling UI and batch export progress
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}