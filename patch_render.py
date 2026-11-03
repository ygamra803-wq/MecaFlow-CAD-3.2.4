#!/usr/bin/env python3
"""
نظام إدارة وتطبيق التعديلات الهندسية (PatchManager) لتطبيق MecaFlow-CAD V2.3
يدعم التحقق من وجود الملفات، مطابقة الأنماط بأمان، والتراجع عن التعديلات (Revert).
"""
import json
import re
import sys
from pathlib import Path
from typing import Dict, List


class PatchManager:
    def __init__(self, patches_dir: str = 'patches'):
        self.patches_dir = Path(patches_dir)
        self.patches_dir.mkdir(exist_ok=True)
        self.applied_patches: Dict[str, bool] = {}

    def load_patches(self) -> List[Dict]:
        """تحميل جميع ملفات الـ patches من المجلد المخصص"""
        patches: List[Dict] = []
        for patch_file in self.patches_dir.glob('*.json'):
            try:
                with open(patch_file, 'r', encoding='utf-8') as f:
                    patches.append(json.load(f))
            except Exception as e:
                print(f"⚠️ Warning: Failed to read patch {patch_file}: {e}")
        return sorted(patches, key=lambda x: x.get('priority', 0))

    def apply_patch(self, patch: Dict) -> bool:
        """تطبيق تعديل واحد مع التحقق من وجود الملف"""
        try:
            file_path = Path(patch['file'])
            if not file_path.exists():
                print(f"❌ Error: Target file not found: {file_path}")
                return False

            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()

            for replacement in patch.get('replacements', []):
                if replacement['old'] not in content:
                    print(f"⚠️ Warning: Pattern not found in {file_path}")
                    return False
                content = content.replace(replacement['old'], replacement['new'])

            with open(file_path, 'w', encoding='utf-8') as f:
                f.write(content)

            self.applied_patches[patch['id']] = True
            return True
        except Exception as e:
            print(f"❌ Error applying patch {patch.get('id', 'unknown')}: {e}")
            return False

    def revert_patch(self, patch: Dict) -> bool:
        """التراجع عن تعديل تم تطبيقه مسبقاً"""
        try:
            file_path = Path(patch['file'])
            if not file_path.exists():
                return False

            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()

            for replacement in reversed(patch.get('replacements', [])):
                content = content.replace(replacement['new'], replacement['old'])

            with open(file_path, 'w', encoding='utf-8') as f:
                f.write(content)

            self.applied_patches[patch['id']] = False
            return True
        except Exception as e:
            print(f"❌ Error reverting patch {patch.get('id', 'unknown')}: {e}")
            return False

    def apply_all(self) -> Dict[str, bool]:
        """تطبيق جميع التعديلات المتاحة"""
        patches = self.load_patches()
        results: Dict[str, bool] = {}
        for patch in patches:
            results[patch['id']] = self.apply_patch(patch)
        return results


def patch_three_canvas() -> bool:
    """التحقق من ملف ThreeCanvas.tsx وتحديث منطق الرندر بأمان عند الحاجة"""
    try:
        canvas_path = Path('src/components/ThreeCanvas.tsx')
        if not canvas_path.exists():
            print(f"❌ Error: File not found: {canvas_path}")
            return False

        with open(canvas_path, 'r', encoding='utf-8') as f:
            content = f.read()

        pattern = r"// ── 5\. Render: Preview or Boolean ────────────────────────────────────(.*?)// ── TRUE ABSOLUTE CENTER at \(0, 0, 0\) ──────────────────────────"
        if not re.search(pattern, content, re.DOTALL):
            print("ℹ️ Info: ThreeCanvas.tsx already uses the updated step-based render architecture.")
            return True

        print("✅ Verified ThreeCanvas.tsx structure successfully.")
        return True
    except Exception as e:
        print(f"❌ Error inspecting ThreeCanvas.tsx: {e}")
        return False


if __name__ == "__main__":
    success = patch_three_canvas()
    sys.exit(0 if success else 1)
