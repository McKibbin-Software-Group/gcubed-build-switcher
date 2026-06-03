import unittest

from gcubed_build_switcher import python_provider


class PythonProviderTests(unittest.TestCase):
    def test_exact_requires_python_returns_exact_patch_request(self):
        request = python_provider.resolve_uv_python_request_for_specifier("==3.13.11")

        self.assertEqual(request, "3.13.11")

    def test_exact_version_must_satisfy_combined_constraints(self):
        with self.assertRaisesRegex(
            python_provider.PythonProviderError,
            "does not satisfy the full combined constraint",
        ):
            python_provider.resolve_uv_python_request_for_specifier(
                "==3.12.10,>=3.13"
            )

    def test_wildcard_exact_requires_python_returns_minor_request(self):
        request = python_provider.resolve_uv_python_request_for_specifier("==3.13.*")

        self.assertEqual(request, "3.13")

    def test_range_requires_python_returns_lowest_minor_request(self):
        request = python_provider.resolve_uv_python_request_for_specifier(
            ">=3.13,<3.14"
        )

        self.assertEqual(request, "3.13")

    def test_multiple_lower_bounds_use_highest_lower_bound(self):
        request = python_provider.resolve_uv_python_request_for_specifier(
            ">=3.12,>=3.13,<3.14"
        )

        self.assertEqual(request, "3.13")

    def test_compatible_release_operator_uses_lower_bound(self):
        request = python_provider.resolve_uv_python_request_for_specifier("~=3.13.2")

        self.assertEqual(request, "3.13.2")

    def test_missing_requires_python_fails_loudly(self):
        with self.assertRaisesRegex(
            python_provider.PythonProviderError,
            "Requires-Python metadata is required",
        ):
            python_provider.resolve_uv_python_request_for_specifier(None)

    def test_invalid_requires_python_fails_loudly(self):
        with self.assertRaisesRegex(
            python_provider.PythonProviderError,
            "not valid",
        ):
            python_provider.resolve_uv_python_request_for_specifier("not-python")

    def test_exclusive_lower_bound_fails_loudly(self):
        with self.assertRaisesRegex(
            python_provider.PythonProviderError,
            "exclusive lower bound",
        ):
            python_provider.resolve_uv_python_request_for_specifier(">3.13,<3.14")

    def test_upper_bound_without_lower_bound_fails_loudly(self):
        with self.assertRaisesRegex(
            python_provider.PythonProviderError,
            "does not contain an exact version or a usable lower bound",
        ):
            python_provider.resolve_uv_python_request_for_specifier("<3.14")


if __name__ == "__main__":
    unittest.main()
