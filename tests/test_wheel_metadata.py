import os
import tempfile
import unittest

try:
    from support import create_fake_wheel
except ModuleNotFoundError:
    from tests.support import create_fake_wheel

from gcubed_build_switcher import wheel_metadata


class WheelMetadataTests(unittest.TestCase):
    def test_wheel_metadata_reads_requires_python(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            wheel_path = create_fake_wheel(
                os.path.join(temp_dir, "gcubed-1.0.0-py3-none-any.whl"),
                requires_python=">=3.13",
            )

            self.assertEqual(
                wheel_metadata.get_wheel_requires_python(wheel_path),
                ">=3.13",
            )

    def test_wheel_metadata_combines_unique_requires_python_constraints(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            wheel_a = create_fake_wheel(
                os.path.join(temp_dir, "gcubed-1.0.0-py3-none-any.whl"),
                name="gcubed",
                requires_python=">=3.13",
            )
            wheel_b = create_fake_wheel(
                os.path.join(temp_dir, "helper-1.0.0-py3-none-any.whl"),
                name="helper",
                requires_python="<3.14",
            )

            self.assertEqual(
                wheel_metadata.get_combined_requires_python([wheel_a, wheel_b]),
                ">=3.13,<3.14",
            )


if __name__ == "__main__":
    unittest.main()
