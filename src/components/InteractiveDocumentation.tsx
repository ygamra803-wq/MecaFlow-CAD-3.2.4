import React, { useState } from 'react';
import { ChevronDown, Code, BookOpen } from 'lucide-react';

interface DocSection {
  id: string;
  title: string;
  description: string;
  content: string;
  codeExample?: string;
  relatedSections?: string[];
}

const InteractiveDocumentation: React.FC = () => {
  const [expandedSection, setExpandedSection] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const docSections: DocSection[] = [
    {
      id: 'zero-gap-logic',
      title: 'منطق Zero-Gap',
      description: 'شرح كيفية عمل نظام التطابق الصفري',
      content: `
        نظام Zero-Gap يعمل على ثلاث مراحل:
        
        1. تحويل عالمي: يتم وضع الأنبوب بالنسبة للمقلاة
        2. طرح Boolean: يتم طرح حجم المقلاة من الأنبوب
        3. استخراج المسار: يتم استخراج خط التقاطع
      `,
      codeExample: `
        const result = CSGEvaluator.subtract(tube, pan);
        const intersectionPath = IntersectionExtractor.extractPath(result);
      `,
      relatedSections: ['csg-operations', 'bezier-curves']
    },
    {
      id: 'csg-operations',
      title: 'عمليات Boolean (CSG)',
      description: 'شرح العمليات البوليانية المستخدمة',
      content: `
        تستخدم المكتبة three-bvh-csg لتنفيذ عمليات Boolean:
        
        - Union: دمج شكلين
        - Subtract: طرح شكل من آخر
        - Intersect: إيجاد التقاطع
      `,
      codeExample: `
        const bvh = new MeshBVH(panGeometry);
        const result = bvh.subtract(tubeGeometry);
      `
    },
    {
      id: 'bezier-curves',
      title: 'منحنيات Bezier',
      description: 'شرح استخدام منحنيات Bezier في توليد الأشكال',
      content: `
        تُستخدم منحنيات Bezier لتعريف ملف تعريف المقلاة:
        
        B(t) = (1-t)²P₀ + 2(1-t)tP₁ + t²P₂
        
        حيث:
        - P₀: نقطة البداية
        - P₁: نقطة التحكم
        - P₂: نقطة النهاية
      `,
      codeExample: `
        const curve = new THREE.QuadraticBezierCurve3(p0, p1, p2);
        const points = curve.getPoints(100);
      `
    }
  ];

  const filteredSections = docSections.filter(section =>
    section.title.includes(searchQuery) ||
    section.description.includes(searchQuery) ||
    section.content.includes(searchQuery)
  );

  return (
    <div className="max-w-4xl mx-auto p-6 bg-zinc-950 text-white rounded-lg">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-4 flex items-center gap-2">
          <BookOpen className="w-8 h-8 text-emerald-500" />
          التوثيق التفاعلية
        </h1>

        <input
          type="text"
          placeholder="ابحث عن موضوع..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg focus:outline-none focus:border-emerald-500"
        />
      </div>

      <div className="space-y-4">
        {filteredSections.map((section) => (
          <div
            key={section.id}
            className="border border-zinc-700 rounded-lg overflow-hidden hover:border-emerald-500 transition-colors"
          >
            <button
              onClick={() =>
                setExpandedSection(
                  expandedSection === section.id ? null : section.id
                )
              }
              className="w-full px-6 py-4 flex items-center justify-between bg-zinc-900 hover:bg-zinc-800 transition-colors"
            >
              <div className="text-left">
                <h2 className="text-lg font-semibold">{section.title}</h2>
                <p className="text-sm text-gray-400 mt-1">
                  {section.description}
                </p>
              </div>
              <ChevronDown
                className={`w-5 h-5 transition-transform ${
                  expandedSection === section.id ? 'rotate-180' : ''
                }`}
              />
            </button>

            {expandedSection === section.id && (
              <div className="px-6 py-4 bg-zinc-950 border-t border-zinc-700 space-y-4">
                <div className="text-gray-300 whitespace-pre-wrap">
                  {section.content}
                </div>

                {section.codeExample && (
                  <div className="bg-black/50 p-4 rounded-lg border border-zinc-700">
                    <div className="flex items-center gap-2 mb-2">
                      <Code className="w-4 h-4 text-emerald-500" />
                      <span className="text-sm font-semibold text-emerald-500">
                        مثال
                      </span>
                    </div>
                    <pre className="text-sm text-gray-300 overflow-x-auto">
                      {section.codeExample}
                    </pre>
                  </div>
                )}

                {section.relatedSections && (
                  <div className="pt-4 border-t border-zinc-700">
                    <p className="text-sm font-semibold mb-2">أقسام ذات صلة:</p>
                    <div className="flex flex-wrap gap-2">
                      {section.relatedSections.map((relatedId) => (
                        <button
                          key={relatedId}
                          onClick={() =>
                            setExpandedSection(relatedId)
                          }
                          className="px-3 py-1 bg-emerald-600/20 hover:bg-emerald-600/40 border border-emerald-600/50 rounded text-sm text-emerald-400 transition-colors"
                        >
                          {docSections.find(s => s.id === relatedId)?.title}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default InteractiveDocumentation;
