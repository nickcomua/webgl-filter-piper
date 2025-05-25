"use client"

import type React from "react"

import { useState, useRef, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Slider } from "@/components/ui/slider"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Progress } from "@/components/ui/progress"
import { Separator } from "@/components/ui/separator"
import { Upload, Play, Square, Download, Trash2, Plus, Settings, Zap, Clock, Cpu, Monitor } from "lucide-react"
import { ReglSurface, type Filter, type FilterTemplate } from "@/lib/gpu/ReglSurface"

interface PerformanceMetrics {
  gpuTime: number
  totalTime: number
  memoryUsage: number
  throughput: number
}

export default function GPUImageProcessingUI() {
  const [selectedImage, setSelectedImage] = useState<string | null>(null)
  const [pipeline, setPipeline] = useState<Filter[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [recentlyAdded, setRecentlyAdded] = useState<string>("")
  const [imageDimensions, setImageDimensions] = useState<{ width: number; height: number } | null>(null)

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

  const handleImageUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onload = (e) => {
        const img = new window.Image()
        img.onload = () => {
          setImageDimensions({ width: img.naturalWidth, height: img.naturalHeight })
          setSelectedImage(e.target?.result as string)
        }
        img.src = e.target?.result as string
      }
      reader.readAsDataURL(file)
    }
  }, [])

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

      // Add animation effect
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

  function getFittedSize(width: number, height: number, maxWidth: number, maxHeight: number) {
    const ratio = Math.min(maxWidth / width, maxHeight / height)
    return {
      width: Math.round(width * ratio),
      height: Math.round(height * ratio),
    }
  }

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
                  GPU Accelerated
                </Badge>
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
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex space-x-2">
                    <Button
                      onClick={() => fileInputRef.current?.click()}
                      variant="outline"
                      className="flex items-center"
                    >
                      <Upload className="w-4 h-4 mr-2" />
                      Load Image
                    </Button>
                    <Button
                      onClick={() => { }}
                      disabled={!selectedImage || pipeline.length === 0}
                      className="flex items-center"
                    >
                      <Play className="w-4 h-4 mr-2" />
                      Process Pipeline
                    </Button>
                    <Button variant="outline" disabled={!selectedImage} className="flex items-center">
                      <Download className="w-4 h-4 mr-2" />
                      Save Result
                    </Button>
                  </div>

                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="hidden"
                  />

                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center min-h-[400px] flex items-center justify-center">
                    {selectedImage && imageDimensions ? (
                      <ReglSurface
                        image={selectedImage}
                        pipeline={pipeline}
                        {...getFittedSize(imageDimensions.width, imageDimensions.height, 600, 400)}
                      />
                    ) : (
                      <div className="text-gray-500">
                        <Upload className="w-12 h-12 mx-auto mb-4 opacity-50" />
                        <p>Click "Load Image" or drag and drop an image here</p>
                        <p className="text-sm mt-2">Supported formats: JPG, PNG, BMP, TIFF</p>
                      </div>
                    )}
                  </div>

                  {/* Performance Metrics */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center">
                        <Clock className="w-5 h-5 mr-2" />
                        Performance Metrics
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="text-center p-3 bg-blue-50 rounded-lg">
                          <div className="text-2xl font-bold text-blue-600">{0}ms</div>
                          <div className="text-sm text-blue-800">GPU Time</div>
                        </div>
                        <div className="text-center p-3 bg-green-50 rounded-lg">
                          <div className="text-2xl font-bold text-green-600">{0}ms</div>
                          <div className="text-sm text-green-800">Total Time</div>
                        </div>
                        <div className="text-center p-3 bg-purple-50 rounded-lg">
                          <div className="text-2xl font-bold text-purple-600">
                            0MB
                          </div>
                          <div className="text-sm text-purple-800">VRAM Usage</div>
                        </div>
                        <div className="text-center p-3 bg-orange-50 rounded-lg">
                          <div className="text-2xl font-bold text-orange-600">
                            0MB/s
                          </div>
                          <div className="text-sm text-orange-800">Throughput</div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Filter Controls */}
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
                                >
                                  {filter.enabled ? "ON" : "OFF"}
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => removeFilterFromPipeline(filter.id)}
                                  className="h-6 w-6 p-0"
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
                          }`}
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
                  <Badge variant="outline">OpenGL 4.5</Badge>
                </div>
                <div className="flex justify-between">
                  <span>GPU Vendor:</span>
                  <Badge variant="outline">Cross-platform</Badge>
                </div>
                <div className="flex justify-between">
                  <span>VRAM Available:</span>
                  <span>8192 MB</span>
                </div>
                <div className="flex justify-between">
                  <span>Compute Shaders:</span>
                  <Badge variant="outline" className="bg-green-50 text-green-700">
                    Supported
                  </Badge>
                </div>
                <Separator className="my-2" />
                <div className="text-xs text-gray-500">
                  Pipeline keeps data in VRAM to minimize CPU-GPU transfer overhead
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
