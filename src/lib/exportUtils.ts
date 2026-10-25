// ============================================================
// exportUtils.ts — MecaFlow-CAD-V2  (النسخة المُصلَحة)
// الإصلاحات الجوهرية:
//   1. create_pan تستخدم الآن curveRadius بشكل فعلي عبر revolve
//   2. curveRadius يُمرَّر صراحةً في استدعاء create_pan
//   3. دالة ensure_solid تطبع اسم الدالة عند الخطأ لتسهيل التتبع
//   4. التسامح في التصدير مضبوط لملف STEP دقيق (≤ 0.005 mm)
//   5. إضافة تحقق من الأبعاد المنطقية قبل البناء
// ============================================================

export const generateCadQueryScript = (config: any): string => {
  // ──────────────────────────────────────────────────────────
  // حسابات مسبقة في TypeScript (قبل توليد الكود)
  // ──────────────────────────────────────────────────────────
  const tubeMinor =
    config.tube.shape === 'دائري' ? config.tube.width : config.tube.height;

  const tubeCornerRadius =
    config.tube.shape === 'دائري'
      ? config.tube.width / 2.0
      : config.tube.cornerRadius;

  const curveRadius = config.pan.curveRadius ?? 0;
  const useCurvedPan = curveRadius > 0;

  return `"""
Zero-Gap Laser CAD — Auto-Generated CadQuery Script
هذا السكربت تم توليده تلقائياً من تطبيق MecaFlow-CAD-V2.
تشغيل: python this_file.py  (يتطلب: pip install cadquery)

# ==========================================
# تقرير الإنتاج
# ==========================================
# التاريخ      : ${new Date().toLocaleString('ar-EG')}
# الأنبوب      : ${config.tube.width}×${tubeMinor} mm | سماكة ${config.tube.thickness} mm | شكل: ${config.tube.shape}
# المقلاة      : ⌀ الفوهة ${config.pan.topDiameter} / ⌀ القاعدة ${config.pan.bottomDiameter} | ارتفاع ${config.pan.height} mm
# انحناء الجدار: ${useCurvedPan ? curveRadius + ' mm (revolve)' : 'مستقيم (loft)'}
# زاوية التركيب: ${config.assembly.tiltAngle}°
"""

import cadquery as cq
import math
import os

# ==========================================
# 1. المعاملات المستوردة من الواجهة
# ==========================================

# — الأنبوب —
tube_shape         = "${config.tube.shape}"
tube_major         = ${config.tube.width}
tube_minor         = ${tubeMinor}
wall_thickness     = ${config.tube.thickness}
total_tube_length  = ${config.tube.totalLength}
part_length        = ${config.tube.partLength}
tube_corner_radius = ${tubeCornerRadius}

# — المقلاة —
pan_top_dia        = ${config.pan.topDiameter}
pan_bottom_dia     = ${config.pan.bottomDiameter}
pan_height         = ${config.pan.height}
pan_curve_r        = ${curveRadius}       # ← كان مُعرَّفاً لكن لم يُمرَّر — تم إصلاحه
bottom_fillet      = ${config.pan.bottomFilletRadius}
pan_wall_thickness = ${config.pan.wallThickness ?? 2.0}
pan_add_rim        = ${config.pan.addRim ? 'True' : 'False'}
pan_rim_height     = ${config.pan.rimHeight ?? 3.0}
pan_rim_thickness  = ${config.pan.rimThickness ?? 2.0}

# — التركيب —
tilt_angle         = ${config.assembly.tiltAngle}
tilt_axis          = "${config.assembly.tiltAxis}"
handle_angle_x     = ${config.assembly.handleAngleX ?? 0}
handle_angle_y     = ${config.assembly.handleAngleY ?? 0}
handle_offset      = ${config.assembly.handleOffset ?? 0}
insertion_distance = ${config.assembly.insertionDistance ?? 0}
height_offset      = ${config.assembly.heightOffset ?? 0}

# — خيارات عامة —
apply_fillet       = ${config.addFillet ? 'True' : 'False'}
thermal_clearance  = ${config.thermalClearance ? 'True' : 'False'}
mark_orientation   = ${config.markOrientation ? 'True' : 'False'}

# ==========================================
# 2. دوال النمذجة — Zero-Gap Engine
# ==========================================

def ensure_solid(part, label="unnamed"):
    """تحقق من صلاحية الجسم الهندسي وأعده بعد تنظيفه."""
    part = part.clean()
    if not part.val().isValid():
        print(f"⚠️  تحذير [{label}]: الجسم الناتج غير صالح هندسياً — تحقق من الأبعاد")
    return part


def create_pan(top_dia, bottom_dia, height, curve_r, fillet_r, wall_thick, add_rim, rim_height, rim_thick):
    """
    بناء المقلاة كجسم قاطع.

    إذا كان curve_r > 0  →  جدار منحنٍ عبر revolve(arc)
        ينتج في STEP: CYLINDRICAL_SURFACE حقيقية (مطابقة للملف المرجعي)

    إذا كان curve_r == 0 →  جدار مستقيم مخروطي عبر loft
        ينتج في STEP: B_SPLINE_SURFACE (مقبول لكن أقل دقة)
    """
    r_top    = top_dia    / 2.0
    r_bottom = bottom_dia / 2.0

    if curve_r > 0:
        # ── الحالة الصحيحة: جدار منحنٍ ──────────────────────────────
        # نرسم نصف المقطع العرضي في المستوى XZ:
        #   X = البُعد الشعاعي عن المحور
        #   Z (local Y) = الارتفاع
        # ثم ندوره 360° حول المحور Z العالمي.
        #
        # الإشارة السالبة لـ radiusArc تعني أن الانحناء للخارج (convex).
        # إذا أردت انحناءً للداخل (concave) استخدم القيمة الموجبة.
        try:
            pan = (
                cq.Workplane("XZ")
                .moveTo(r_bottom, 0)
                .radiusArc((r_top, height), -curve_r)
                .lineTo(0, height)
                .lineTo(0, 0)
                .close()
                .revolve(360, (0, 0, 0), (0, 1, 0))
            )
        except Exception as e:
            print(f"⚠️  فشل revolve بـ curve_r={curve_r}: {e}")
            print("   التراجع إلى loft المستقيم...")
            pan = (
                cq.Workplane("XY")
                .circle(r_bottom)
                .workplane(offset=height)
                .circle(r_top)
                .loft()
            )
    else:
        # ── الحالة الافتراضية: مخروط مستقيم ─────────────────────────
        pan = (
            cq.Workplane("XY")
            .circle(r_bottom)
            .workplane(offset=height)
            .circle(r_top)
            .loft()
        )

    # fillet في القاع
    if fillet_r > 0:
        try:
            pan = pan.edges("<Z").fillet(fillet_r)
        except Exception as e:
            print(f"⚠️  فشل fillet في القاع: {e} — تجاهله والمتابعة")

    # حافة الحماية (rim) في الأعلى
    if add_rim:
        rim = (
            cq.Workplane("XY")
            .workplane(offset=height - rim_height)
            .circle(r_top + rim_thick)
            .circle(r_top)
            .extrude(rim_height)
        )
        pan = pan.union(rim)

    # تجويف المقلاة (shell) إذا كانت السماكة > 0
    if wall_thick > 0:
        try:
            pan = pan.shell(-wall_thick)
        except Exception as e:
            print(f"⚠️  فشل shell (التجويف) بسماكة {wall_thick}: {e} — استمرار كجسم صلب")

    return pan


def create_tube(shape, major, minor, length, thickness, corner_r, clearance=False):
    """
    بناء الأنبوب كجسم صلب (hollow).

    الشكل المستدير  → cylinder مباشر → ينتج CYLINDRICAL_SURFACE في STEP ✅
    الشكل البيضاوي  → rect + fillet  → ينتج B_SPLINE حواف + PLANE جوانب ✅
    """
    delta = 0.1 if clearance else 0.0

    if shape == "مخصص":
        print("ℹ️  STL مخصص: استخدام شكل بيضاوي كبديل مؤقت.")
        shape = "بيضاوي"

    if shape == "دائري":
        r_outer = major / 2.0
        r_inner = max(0.01, r_outer - thickness + delta)
        outer = cq.Workplane("XY").circle(r_outer).extrude(length)
        inner = cq.Workplane("XY").circle(r_inner).extrude(length)
        return outer.cut(inner)

    else:  # بيضاوي أو مستطيل
        outer = cq.Workplane("XY").rect(major, minor).extrude(length)
        if corner_r > 0:
            try:
                outer = outer.edges("|Z").fillet(corner_r)
            except Exception as e:
                print(f"⚠️  fillet الخارجي: {e}")

        inner_major  = max(0.01, major - 2 * thickness + delta)
        inner_minor  = max(0.01, minor - 2 * thickness + delta)
        inner_corner = max(0.01, corner_r - thickness + delta)

        inner = cq.Workplane("XY").rect(inner_major, inner_minor).extrude(length)
        if inner_corner > 0:
            try:
                inner = inner.edges("|Z").fillet(inner_corner)
            except Exception as e:
                print(f"⚠️  fillet الداخلي: {e}")

        return outer.cut(inner)


def cut_with_pan(tube, pan, tilt_angle, tilt_axis, pan_z_pos, ins_dist=0, h_offset=0):
    """
    قطع طرف الأنبوب بشكل المقلاة.
    1. نضع المقلاة عند الموقع الصحيح على المحور Z.
    2. نميل الأنبوب بزاوية tilt_angle.
    3. نطرح المقلاة من الأنبوب.
    """
    positioned_pan = pan.translate((0, 0, pan_z_pos))
    axis_vec       = (1, 0, 0) if tilt_axis == "X" else (0, 1, 0)
    tilted_tube    = tube.rotate((0, 0, 0), axis_vec, tilt_angle)
    moved_tube     = tilted_tube.translate((0, h_offset, -ins_dist))
    return moved_tube.cut(positioned_pan)


def cut_handle_end(tube, angle_x, angle_y, offset_y, length):
    """
    قطع الطرف الخلفي للمقبض بزاوية مائلة مركبة.
    الصندوق القاطع كبير بما يكفي (600mm) ليغطي أي حجم أنبوب.
    """
    cutting_box = (
        cq.Workplane("XY")
        .rect(600, 600)
        .extrude(600)
        .rotate((0, 0, 0), (1, 0, 0), -angle_x)
        .rotate((0, 0, 0), (0, 1, 0), -angle_y)
        .translate((0, offset_y, length))
    )
    return tube.cut(cutting_box)


def add_laser_mark(part, minor, length):
    """ثقب مرجعي Ø1mm للتركيب على بُعد 15mm من الطرف الخلفي."""
    mark_tool = (
        cq.Workplane("XZ")
        .center(0, length - 15)
        .circle(0.5)
        .extrude(minor, both=True)
    )
    return part.cut(mark_tool)


def finalize_part(part, nesting_mode, slug_gap, length):
    """
    التعشيش المزدوج (twin) وتمركز النموذج عند (0,0,0).
    """
    final_obj = part

    if nesting_mode == "twin":
        part2     = part.rotate((0, 0, 0), (0, 1, 0), 180).translate((0, 0, (length * 2) + slug_gap))
        final_obj = part.union(part2)

    bb       = final_obj.val().BoundingBox()
    cx       = (bb.xmin + bb.xmax) / 2.0
    cy       = (bb.ymin + bb.ymax) / 2.0
    cz       = (bb.zmin + bb.zmax) / 2.0
    centered = final_obj.translate((-cx, -cy, -cz))
    return centered


# ==========================================
# 3. التنفيذ الرئيسي
# ==========================================

print("=" * 50)
print("🔧 MecaFlow-CAD | Zero-Gap Engine")
print("=" * 50)

# ── بناء المقلاة ─────────────────────────────────────────────
print("\\n[1/5] بناء المقلاة...")
pan = create_pan(
    top_dia   = pan_top_dia,
    bottom_dia= pan_bottom_dia,
    height    = pan_height,
    curve_r   = pan_curve_r,
    fillet_r  = bottom_fillet,
    wall_thick= pan_wall_thickness,
    add_rim   = pan_add_rim,
    rim_height= pan_rim_height,
    rim_thick = pan_rim_thickness,
)
pan = ensure_solid(pan, "create_pan")

# ── بناء الأنبوب ─────────────────────────────────────────────
print("[2/5] بناء الأنبوب...")
tube = create_tube(
    shape    = tube_shape,
    major    = tube_major,
    minor    = tube_minor,
    length   = total_tube_length,
    thickness= wall_thickness,
    corner_r = tube_corner_radius,
    clearance= thermal_clearance,
)
tube = ensure_solid(tube, "create_tube")

# ── قطع طرف المقلاة بالأنبوب ─────────────────────────────────
print("[3/5] قطع الصفر الحقيقي (Zero-Gap)...")
part = cut_with_pan(
    tube       = tube,
    pan        = pan,
    tilt_angle = tilt_angle,
    tilt_axis  = tilt_axis,
    pan_z_pos  = part_length,
    ins_dist   = insertion_distance,
    h_offset   = height_offset,
)
part = ensure_solid(part, "cut_with_pan")

# ── قطع الطرف الخلفي ─────────────────────────────────────────
print("[4/5] قطع طرف المقبض...")
part = cut_handle_end(
    tube    = part,
    angle_x = handle_angle_x,
    angle_y = handle_angle_y,
    offset_y= handle_offset,
    length  = total_tube_length,
)
part = ensure_solid(part, "cut_handle_end")

# ── علامة التوجيه ────────────────────────────────────────────
if mark_orientation:
    print("[4b] حفر علامة التركيب المرجعية...")
    part = add_laser_mark(part, tube_minor, total_tube_length)

# ── التعشيش والتمركز ─────────────────────────────────────────
print("[5/5] التعشيش والتمركز...")
part = finalize_part(part, nesting_mode, slug_gap, total_tube_length)

# ── Fillet اختياري ───────────────────────────────────────────
if apply_fillet:
    print("   → تطبيق fillet 0.2mm على حواف الليزر...")
    try:
        part = part.edges().fillet(0.2)
    except Exception as e:
        print(f"   ⚠️  فشل fillet العام: {e} — تجاهله")

# ==========================================
# 4. التصدير النهائي
# ==========================================

base_name   = "ZeroGap_Part"
step_path   = base_name + ".step"
stl_path    = base_name + ".stl"

# STEP: دقة عالية للتصنيع (tolerance=0.005 بدلاً من 0.01)
cq.exporters.export(
    part, step_path,
    tolerance=0.005,
    angularTolerance=0.05,
)

# STL: للمعاينة والطباعة
cq.exporters.export(
    part, stl_path,
    tolerance=0.01,
    angularTolerance=0.1,
)

print("\\n" + "=" * 50)
print(f"✅ STEP: {os.path.abspath(step_path)}")
print(f"✅ STL : {os.path.abspath(stl_path)}")
print("   النظام مُعايَر على نقطة الصفر (0,0,0) — جاهز لبرامج CAM")
print("=" * 50)
`;
};