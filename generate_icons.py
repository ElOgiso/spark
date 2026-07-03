import os
try:
    from PIL import Image, ImageDraw
except ImportError:
    import subprocess
    subprocess.run(["pip", "install", "Pillow"])
    from PIL import Image, ImageDraw

def create_spark_icon(size, filename, maskable=False):
    # Dark blue background: #0B0F19
    bg_color = (11, 15, 25)
    img = Image.new("RGBA", (size, size), bg_color)
    draw = ImageDraw.Draw(img)
    
    # Draw simple sparkling icon in the center
    center = size / 2
    
    # If maskable, icon must stay within 60% safe area
    radius = size * 0.25 if maskable else size * 0.35
    
    # Spark star (4-pointed star)
    # North, East, South, West points
    points = [
        (center, center - radius), # North
        (center + radius * 0.25, center - radius * 0.25),
        (center + radius, center), # East
        (center + radius * 0.25, center + radius * 0.25),
        (center, center + radius), # South
        (center - radius * 0.25, center + radius * 0.25),
        (center - radius, center), # West
        (center - radius * 0.25, center - radius * 0.25)
    ]
    
    # Elegant glow accent colors (purple/pink)
    draw.polygon(points, fill=(124, 58, 237)) # Violet-600
    
    # Inner star
    inner_radius = radius * 0.4
    inner_points = [
        (center, center - inner_radius),
        (center + inner_radius * 0.25, center - inner_radius * 0.25),
        (center + inner_radius, center),
        (center + inner_radius * 0.25, center + inner_radius * 0.25),
        (center, center + inner_radius),
        (center - inner_radius * 0.25, center + inner_radius * 0.25),
        (center - inner_radius, center),
        (center - inner_radius * 0.25, center - inner_radius * 0.25)
    ]
    draw.polygon(inner_points, fill=(236, 72, 153)) # Pink-500
    
    # Center core
    draw.ellipse([center - 4, center - 4, center + 4, center + 4], fill=(255, 255, 255))
    
    os.makedirs(os.path.dirname(filename), exist_ok=True)
    img.save(filename, "PNG")
    print(f"Created {filename}")

create_spark_icon(192, "public/icons/icon-192.png", maskable=False)
create_spark_icon(512, "public/icons/icon-512.png", maskable=False)
create_spark_icon(192, "public/icons/icon-192-maskable.png", maskable=True)
create_spark_icon(512, "public/icons/icon-512-maskable.png", maskable=True)
print("PWA Icons generated successfully!")
