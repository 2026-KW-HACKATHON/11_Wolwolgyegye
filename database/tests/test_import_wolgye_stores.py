import io
import unittest
from pathlib import Path
from importlib.util import module_from_spec, spec_from_file_location
from unittest.mock import patch


SCRIPT = Path(__file__).resolve().parents[1] / "scripts" / "import_wolgye_stores.py"
spec = spec_from_file_location("import_wolgye_stores", SCRIPT)
module = module_from_spec(spec)
spec.loader.exec_module(module)


class FakeCsvPath:
    name = "서울.csv"

    def open(self, **_kwargs):
        return io.StringIO(
            "상가업소번호,상호명,상권업종소분류명,시도명,시군구명,행정동명,도로명주소,지번주소,경도,위도\n"
            "A1,영's 카페,카페,서울특별시,노원구,월계1동,서울특별시 노원구 광운로 1,,127.06,37.62\n"
            "B2,다른 동,카페,서울특별시,노원구,월계2동,서울특별시 노원구 광운로 2,,127.06,37.62\n"
        )


class ImportWolgyeStoresTest(unittest.TestCase):
    def test_filters_exact_dong_and_escapes_sql(self):
        with patch.object(module.zipfile, "is_zipfile", return_value=False):
            rows, scanned = module.collect(FakeCsvPath())
        self.assertEqual(scanned, 2)
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0]["상호명"], "영's 카페")
        self.assertEqual(module.sql_literal(rows[0]["상호명"]), "'영''s 카페'")
        self.assertEqual(module.stable_uuid("A1"), module.stable_uuid("A1"))
        self.assertNotEqual(module.stable_uuid("A1"), module.stable_uuid("B2"))


if __name__ == "__main__":
    unittest.main()
