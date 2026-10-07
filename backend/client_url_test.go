package main

import (
	"net/url"
	"testing"
)

func TestProjectPathEncoding(t *testing.T) {
	c := newGLClient("tok", "https://gitlab.com")
	got := c.projectPath("group/sub", "proj")
	want := url.PathEscape("group/sub/proj")
	if got != want {
		t.Fatalf("projectPath = %q, want %q", got, want)
	}
}

func TestNormalizeInstanceURL(t *testing.T) {
	cases := []struct {
		in, want string
	}{
		{"", defaultGitLabInstance},
		{"https://gitlab.example.com/", "https://gitlab.example.com"},
		{"gitlab.example.com", "https://gitlab.example.com"},
		{"http://gitlab.local", "http://gitlab.local"},
	}
	for _, tc := range cases {
		if got := normalizeInstanceURL(tc.in); got != tc.want {
			t.Fatalf("normalizeInstanceURL(%q)=%q want %q", tc.in, got, tc.want)
		}
	}
}

func TestCloneURL(t *testing.T) {
	c := newGLClient("", "https://gitlab.example.com")
	got := c.cloneURL("acme/app")
	want := "https://gitlab.example.com/acme/app.git"
	if got != want {
		t.Fatalf("cloneURL = %q, want %q", got, want)
	}
}
