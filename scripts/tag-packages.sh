#!/bin/bash

# Package Tagging Script for Albatrion Monorepo
# Automatically creates individual package tags based on package.json versions in a specific commit

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to strip ANSI color codes for clean output
strip_colors() {
    sed -e 's/\x1b\[[0-9;]*m//g' -e 's/\[[0-9;]*m//g'
}

# Print colored output
print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Function to extract name and version from package.json
extract_package_info() {
    local commit_hash=$1
    local package_path=$2
    
    # Try to get package.json content from the specific commit
    local package_content
    if package_content=$(git show "$commit_hash:$package_path" 2>/dev/null); then
        local name=$(echo "$package_content" | grep -E '"name"' | head -1 | sed 's/.*"name"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/')
        local version=$(echo "$package_content" | grep -E '"version"' | head -1 | sed 's/.*"version"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/')
        local private=$(echo "$package_content" | grep -E '"private"' | head -1 | sed 's/.*"private"[[:space:]]*:[[:space:]]*\([^,}]*\).*/\1/')
        
        # Skip if private is true or name is invalid
        if [[ -n "$name" && -n "$version" && "$name" != "Vincent K. Kelvin" && "$private" != "true" ]]; then
            echo "$name@$version"
        fi
    fi
}

# Function to check if commit exists
check_commit_exists() {
    local commit_hash=$1
    if ! git rev-parse --verify "$commit_hash" >/dev/null 2>&1; then
        print_error "Commit hash '$commit_hash' does not exist!"
        exit 1
    fi
}

# Function to check if tag already exists
check_tag_exists() {
    local tag_name=$1
    if git tag -l | grep -q "^$tag_name$"; then
        return 0  # Tag exists
    else
        return 1  # Tag doesn't exist
    fi
}

# Main function
main() {
    local commit_hash=""
    local push_tags=false
    
    # Parse arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            --push|-p)
                push_tags=true
                shift
                ;;
            -*)
                print_error "Unknown option: $1"
                print_info "Usage: $0 <commit_hash> [--push|-p]"
                print_info "Example: $0 dcd9a7826f95ec694bbc7cfc4a79f10af93444ad"
                print_info "Example: $0 dcd9a7826f95ec694bbc7cfc4a79f10af93444ad --push"
                print_info "Example: $0 dcd9a7826f95ec694bbc7cfc4a79f10af93444ad -p"
                exit 1
                ;;
            *)
                if [[ -z "$commit_hash" ]]; then
                    commit_hash="$1"
                else
                    print_error "Multiple commit hashes provided: '$commit_hash' and '$1'"
                    exit 1
                fi
                shift
                ;;
        esac
    done
    
    # Validate input
    if [[ -z "$commit_hash" ]]; then
        print_error "Usage: $0 <commit_hash> [--push|-p]"
        print_info "Example: $0 dcd9a7826f95ec694bbc7cfc4a79f10af93444ad"
        print_info "Example: $0 dcd9a7826f95ec694bbc7cfc4a79f10af93444ad --push"
        print_info "Example: $0 dcd9a7826f95ec694bbc7cfc4a79f10af93444ad -p"
        exit 1
    fi
    
    # Check if commit exists
    check_commit_exists "$commit_hash"
    
    print_info "Analyzing packages in commit: $commit_hash"
    
    # Get commit info
    local commit_date=$(git show -s --format=%ci "$commit_hash")
    local commit_message=$(git show -s --format=%s "$commit_hash")
    print_info "Commit: $commit_message ($commit_date)"
    
    # Find all package.json files in the commit (excluding node_modules)
    local package_files
    if ! package_files=$(git ls-tree -r --name-only "$commit_hash" | grep -E '^packages/.*package\.json$' | grep -v node_modules); then
        print_warning "No package.json files found in packages/ directory for commit $commit_hash"
        exit 0
    fi
    
    # Array to store package info
    declare -a packages_to_tag=()
    declare -a existing_tags=()
    
    print_info "Found package.json files:"
    
    # Process each package.json
    while IFS= read -r package_file; do
        local package_info
        if package_info=$(extract_package_info "$commit_hash" "$package_file"); then
            if [[ -n "$package_info" ]]; then
                print_info "  📦 $package_info (from $package_file)"
                
                # Check if tag already exists
                if check_tag_exists "$package_info"; then
                    existing_tags+=("$package_info")
                    print_warning "    Tag '$package_info' already exists"
                else
                    packages_to_tag+=("$package_info")
                    print_success "    Will create tag: $package_info"
                fi
            fi
        fi
    done <<< "$package_files"
    
    # Summary
    echo
    print_info "=== Summary ==="
    print_info "Packages to tag: ${#packages_to_tag[@]}"
    print_info "Existing tags: ${#existing_tags[@]}"
    
    if [[ ${#packages_to_tag[@]} -eq 0 ]]; then
        print_warning "No new tags to create. All packages already have tags for this version."
        exit 0
    fi
    
    # Show packages to be tagged
    echo
    print_info "Packages that will be tagged:"
    for package in "${packages_to_tag[@]}"; do
        echo "  • $package"
    done
    
    # Confirmation
    echo
    read -p "Do you want to create these tags? (y/N): " -r
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        print_info "Operation cancelled."
        exit 0
    fi
    
    # Create tags
    echo
    print_info "Creating tags..."
    
    local created_count=0
    for package in "${packages_to_tag[@]}"; do
        if git tag "$package" "$commit_hash"; then
            print_success "Created tag: $package"
            ((created_count++))
        else
            print_error "Failed to create tag: $package"
        fi
    done
    
    print_success "Successfully created $created_count tags"
    
    # Push tags if requested
    if [[ "$push_tags" == true ]]; then
        echo
        read -p "Do you want to push the tags to origin? (y/N): " -r
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            print_info "Pushing tags to origin..."
            if git push origin --tags; then
                print_success "Tags pushed successfully!"
            else
                print_error "Failed to push tags"
                exit 1
            fi
        fi
    else
        echo
        print_info "To push the tags to origin, run:"
        print_info "  git push origin --tags"
        print_info ""
        print_info "Or run this script with '--push' flag:"
        print_info "  $0 $commit_hash --push"
    fi
    
    # Show final tag list
    echo
    print_info "Current package tags:"
    git tag -l | grep -E "@(winglet|canard|lerx)" | sort | while read -r tag; do
        echo "  📌 $tag"
    done
}

# Run main function with all arguments
main "$@" 