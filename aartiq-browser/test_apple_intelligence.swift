import Foundation

// Check FoundationModels availability
#if canImport(FoundationModels)
print("FoundationModels is available")
#else
print("FoundationModels is NOT available")
#endif

// Check ImagePlayground availability
#if canImport(ImagePlayground)
print("ImagePlayground is available")
#else
print("ImagePlayground is NOT available")
#endif
